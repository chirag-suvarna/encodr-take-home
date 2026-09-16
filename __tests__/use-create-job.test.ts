import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "@/lib/types";

const post = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client/api", () => ({
  api: { get, post },
}));

import { jobKeys, useCreateJob } from "@/lib/client/hooks";

const existing: Job = {
  id: "j_old",
  title: "Old",
  sourceUrl: "https://cdn.example.com/videos/old.mp4",
  status: "NEW",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(jobKeys.all, [existing]);
  get.mockImplementation(async () => client.getQueryData(jobKeys.all) ?? []);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const hook = renderHook(() => useCreateJob(), { wrapper });
  return { client, hook };
}

beforeEach(() => {
  post.mockReset();
  get.mockReset();
});

describe("useCreateJob optimistic cache", () => {
  it("inserts a temp job, then replaces it with the server job", async () => {
    const created: Job = {
      id: "j_real",
      title: "Clip",
      sourceUrl: "https://cdn.example.com/videos/clip.mp4",
      status: "NEW",
      createdAt: "2026-01-02T00:00:00.000Z",
    };
    let resolve!: (job: Job) => void;
    post.mockImplementation(() => new Promise<Job>((r) => { resolve = r; }));

    const { client, hook } = setup();
    const pending = hook.result.current.mutateAsync({
      sourceUrl: created.sourceUrl,
      title: created.title,
    });

    await waitFor(() => {
      const ids = client.getQueryData<Job[]>(jobKeys.all)?.map((j) => j.id) ?? [];
      expect(ids[0]).toMatch(/^optimistic-/);
      expect(ids).toContain("j_old");
    });

    resolve(created);
    await pending;

    await waitFor(() => {
      expect(client.getQueryData<Job[]>(jobKeys.all)?.map((j) => j.id)).toEqual(["j_real", "j_old"]);
    });
  });

  it("rolls the list back when the server rejects", async () => {
    post.mockRejectedValueOnce(new Error("nope"));
    const { client, hook } = setup();

    await expect(
      hook.result.current.mutateAsync({
        sourceUrl: "https://cdn.example.com/videos/clip.mp4",
        title: "Clip",
      }),
    ).rejects.toThrow("nope");

    expect(client.getQueryData<Job[]>(jobKeys.all)?.map((j) => j.id)).toEqual(["j_old"]);
  });
});
