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
    setState({ ...initialState });

    void fetchEventSource(`/api/runs/${runId}/events`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${getAccessToken() ?? ""}`,
        accept: "text/event-stream",
      },
      signal: ac.signal,
      openWhenHidden: true,
      async onopen(res) {
        if (cancelled) return;
        if (!res.ok) throw new Error(`SSE ${res.status}`);
        setState((s) => ({ ...s, connected: true }));
      },
      onmessage(ev) {
        if (cancelled || !ev.data) return;
        const data = JSON.parse(ev.data) as RunEvent;
        const done = isTerminalStage(data.stage);
        setState((s) => ({
          stage: data.stage,
          progressPct: data.progressPct,
          log: s.log[s.log.length - 1] === data.message ? s.log : [...s.log, data.message],
          error: data.error ?? null,
          connected: true,
          done,
        }));
        if (done && !settled) {
          settled = true;
          onTerminalRef.current?.();
          ac.abort();
        }
      },
      onerror(err) {
        throw err;
      },
    }).catch(() => {
      /* aborted or failed open — don't retry */
    });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [runId]);

  return state;
}
