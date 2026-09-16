"use client";

import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/client/token-store";
import { isTerminalStage, type RunEvent, type Stage } from "@/lib/types";

export const MAX_RECONNECT_ATTEMPTS = 5;

export function reconnectDelayMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 10_000);
}

export interface RunStreamState {
  stage: Stage | null;
  progressPct: number;
  log: string[];
  error: string | null;
  connected: boolean;
  done: boolean;
  /** Transport / missing-run, not an encoder FAILED. */
  connectionError: string | null;
}

const initialState: RunStreamState = {
  stage: null,
  progressPct: 0,
  log: [],
  error: null,
  connected: false,
  done: false,
  connectionError: null,
};

export function useRunStream(
  runId: string | null,
  onTerminal?: () => void,
): RunStreamState & { reconnect: () => void } {
  const [state, setState] = useState<RunStreamState>(initialState);
  const [epoch, setEpoch] = useState(0);
  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;

  const reconnect = useCallback(() => setEpoch((n) => n + 1), []);

  useEffect(() => {
    if (!runId) {
      setState(initialState);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;
    let settled = false;
    let attempts = 0;
    const headers: Record<string, string> = {
      authorization: `Bearer ${getAccessToken() ?? ""}`,
      accept: "text/event-stream",
    };
    setState({ ...initialState });

    void fetchEventSource(`/api/runs/${runId}/events`, {
      method: "GET",
      headers,
      signal: ac.signal,
      openWhenHidden: true,
      async onopen(res) {
        if (cancelled) return;
        if (res.status === 404) {
          cancelled = true;
          setState((s) => ({
            ...s,
            connected: false,
            connectionError: "Run unavailable",
          }));
          throw new Error("SSE 404");
        }
        if (!res.ok) throw new Error(`SSE ${res.status}`);
        attempts = 0;
        setState((s) => ({ ...s, connected: true, connectionError: null }));
      },
      onmessage(ev) {
        if (cancelled || !ev.data) return;
        if (ev.id) headers["last-event-id"] = ev.id;
        const data = JSON.parse(ev.data) as RunEvent;
        const done = isTerminalStage(data.stage);
        setState((s) => {
          const last = s.log[s.log.length - 1];
          const duplicate = last?.endsWith(data.message);
          const time = new Date().toLocaleTimeString(undefined, { hour12: false });
          return {
            stage: data.stage,
            progressPct: data.progressPct,
            log: duplicate ? s.log : [...s.log, `${time} ${data.message}`],
            error: data.error ?? null,
            connected: true,
            done,
            connectionError: null,
          };
        });
        if (done && !settled) {
          settled = true;
          cancelled = true;
          onTerminalRef.current?.();
          ac.abort();
        }
      },
      onerror(err) {
        // RECONNECT: transport blip while RUNNING → bounded backoff.
        // STOP:     COMPLETED/FAILED or 404-run or retry ceiling → throw.
        // ABORT:    unmount / runId change → throw (no zombie streams).
        // Never starts a new encode run from here.
        if (cancelled || ac.signal.aborted) throw err;
        attempts += 1;
        if (attempts > MAX_RECONNECT_ATTEMPTS) {
          cancelled = true;
          setState((s) => ({
            ...s,
            connected: false,
            connectionError: "Connection unavailable",
          }));
          throw err;
        }
        setState((s) => ({ ...s, connected: false }));
        return reconnectDelayMs(attempts);
      },
    }).catch(() => {
      /* aborted, terminal, 404, or retry ceiling */
    });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [runId, epoch]);

  return { ...state, reconnect };
}
