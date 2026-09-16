import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchEventSource = vi.hoisted(() => vi.fn());

vi.mock("@microsoft/fetch-event-source", () => ({
  fetchEventSource,
}));

import { useRunStream } from "@/lib/client/use-run-stream";

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
});
