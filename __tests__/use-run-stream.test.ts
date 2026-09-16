import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchEventSource = vi.hoisted(() => vi.fn());

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource,
}));

import { MAX_RECONNECT_ATTEMPTS, useRunStream } from "@/lib/client/use-run-stream";

afterEach(() => {
  fetchEventSource.mockReset();
});

describe("useRunStream", () => {
  it("aborts the previous connection when runId changes, and on unmount", async () => {
    const signals: AbortSignal[] = [];
    const onmessages: Array<(ev: { data: string }) => void> = [];

    fetchEventSource.mockImplementation((_url: string, init: { signal: AbortSignal; onmessage: (ev: { data: string }) => void }) => {
      signals.push(init.signal);
      onmessages.push(init.onmessage);
      return new Promise(() => undefined);
    });

    const { rerender, unmount } = renderHook(({ runId }: { runId: string | null }) => useRunStream(runId), {
      initialProps: { runId: "r1" },
    });

    expect(fetchEventSource).toHaveBeenCalledTimes(1);
    expect(signals[0]?.aborted).toBe(false);

    rerender({ runId: "r2" });
    expect(fetchEventSource).toHaveBeenCalledTimes(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);

    unmount();
    expect(signals[1]?.aborted).toBe(true);

    expect(() => {
      act(() => {
        onmessages[1]?.({
          data: JSON.stringify({ stage: "TRANSCODING", progressPct: 50, message: "late" }),
        });
      });
    }).not.toThrow();
  });

  it("stops reconnecting after a terminal COMPLETED event", () => {
    const signals: AbortSignal[] = [];
    let onmessage: ((ev: { id?: string; data: string }) => void) | undefined;
    let onerror: ((err: unknown) => unknown) | undefined;

    fetchEventSource.mockImplementation(
      (
        _url: string,
        init: {
          signal: AbortSignal;
          onmessage: (ev: { id?: string; data: string }) => void;
          onerror: (err: unknown) => unknown;
        },
      ) => {
        signals.push(init.signal);
        onmessage = init.onmessage;
        onerror = init.onerror;
        return new Promise(() => undefined);
      },
    );

    renderHook(() => useRunStream("r1"));
    act(() => {
      onmessage?.({
        id: "1",
        data: JSON.stringify({ stage: "COMPLETED", progressPct: 100, message: "Encode finished" }),
      });
    });
    expect(signals[0]?.aborted).toBe(true);
    expect(() => onerror?.(new Error("blip"))).toThrow();
  });

  it("retries on a transport blip while mounted, but not after unmount", () => {
    const signals: AbortSignal[] = [];
    const onerrors: Array<(err: unknown) => unknown> = [];

    fetchEventSource.mockImplementation((_url: string, init: { signal: AbortSignal; onerror: (err: unknown) => unknown }) => {
      signals.push(init.signal);
      onerrors.push(init.onerror);
      return new Promise(() => undefined);
    });

    const { unmount } = renderHook(() => useRunStream("r1"));
    act(() => {
      expect(onerrors[0]?.(new Error("blip"))).toBe(1000);
      expect(onerrors[0]?.(new Error("blip"))).toBe(2000);
    });
    expect(signals[0]?.aborted).toBe(false);

    unmount();
    expect(signals[0]?.aborted).toBe(true);
    expect(() => onerrors[0]?.(new Error("blip"))).toThrow();
  });

  it("stops after the reconnect ceiling", () => {
    let onerror: ((err: unknown) => unknown) | undefined;
    fetchEventSource.mockImplementation((_url: string, init: { onerror: (err: unknown) => unknown }) => {
      onerror = init.onerror;
      return new Promise(() => undefined);
    });

    const { result } = renderHook(() => useRunStream("r1"));
    act(() => {
      for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
        expect(onerror?.(new Error("blip"))).toEqual(expect.any(Number));
      }
    });
    act(() => {
      expect(() => onerror?.(new Error("blip"))).toThrow();
    });
    expect(result.current.connectionError).toBe("Connection unavailable");
  });
});
