"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { CreateJobInput } from "@/lib/schemas";
import type { EncodeRun, Job } from "@/lib/types";

export const jobKeys = {
  all: ["jobs"] as const,
  detail: (id: string) => ["jobs", id] as const,
};

// Two worked examples to show the intended React Query pattern:
export function useJobs() {
  return useQuery({
    queryKey: jobKeys.all,
    queryFn: ({ signal }) => api.get<Job[]>("/api/jobs", signal),
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: ({ signal }) => api.get<Job>(`/api/jobs/${id}`, signal),
  });
}

function optimisticTitle(input: CreateJobInput): string {
  const titled = input.title?.trim();
  if (titled) return titled;
  try {
    const path = new URL(input.sourceUrl).pathname.replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "Untitled encode";
  } catch {
    return "Untitled encode";
  }
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJobInput) => api.post<Job>("/api/jobs", input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: jobKeys.all });
      const previous = queryClient.getQueryData<Job[]>(jobKeys.all);
      const optimistic: Job = {
        id: `optimistic-${crypto.randomUUID()}`,
        title: optimisticTitle(input),
        sourceUrl: input.sourceUrl,
        status: "NEW",
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<Job[]>(jobKeys.all, (old) => [optimistic, ...(old ?? [])]);
      return { previous, optimisticId: optimistic.id };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(jobKeys.all, ctx.previous);
      }
    },
    onSuccess: (job, _input, ctx) => {
      queryClient.setQueryData<Job[]>(jobKeys.all, (old) => {
        if (!old) return [job];
        return old.map((item) => (item.id === ctx?.optimisticId ? job : item));
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

export function useStartRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => api.post<{ runId: string }>("/api/runs", { jobId }),
    onSuccess: (_data, jobId) => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all });
      void queryClient.invalidateQueries({ queryKey: jobKeys.detail(jobId) });
    },
  });
}

export function fetchRun(runId: string) {
  return api.get<EncodeRun>(`/api/runs/${runId}`);
}

export function useRun(runId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["runs", runId],
    queryFn: () => fetchRun(runId!),
    enabled: Boolean(runId) && enabled,
  });
}
