"use client";

import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/client/token-store";
import { isTerminalStage, type RunEvent, type Stage } from "@/lib/types";

export interface RunStreamState {
  stage: Stage | null;
  progressPct: number;
  log: string[];
  error: string | null;
  connected: boolean;
  done: boolean;
}

const initialState: RunStreamState = {
  stage: null,
  progressPct: 0,
  log: [],
  error: null,
  connected: false,
  done: false,
};

export function useRunStream(runId: string | null, onTerminal?: () => void): RunStreamState {
  const [state, setState] = useState<RunStreamState>(initialState);
  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;

  useEffect(() => {
    if (!runId) {
      setState(initialState);
      return;
    }

    const ac = new AbortController();
    let cancelled = false;
    let settled = false;
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
        if (!res.ok) throw new Error(`SSE ${res.status}`);
        setState((s) => ({ ...s, connected: true }));
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
        // RECONNECT: transport blip while RUNNING → return delay (not a while(true) loop).
        // STOP:     COMPLETED/FAILED set cancelled and abort → throw, no retry.
        // ABORT:    unmount / runId change → throw, no retry (no zombie streams).
        if (cancelled || ac.signal.aborted) throw err;
        setState((s) => ({ ...s, connected: false }));
        return 1000;
      },
    }).catch(() => {
      /* aborted, terminal, or fatal open */
    });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [runId]);

  return state;
}
