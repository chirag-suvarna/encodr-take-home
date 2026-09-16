import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/client/api";

const mutateAsync = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client/hooks", () => ({
  useJobs: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateJob: () => ({ mutateAsync, isPending: false }),
}));

import JobsPage from "@/app/(app)/jobs/page";

beforeEach(() => {
  mutateAsync.mockReset();
});

describe("create job form", () => {
  it("shows a client Zod error for a bad URL and does not POST", async () => {
    const user = userEvent.setup();
    render(<JobsPage />);

    await user.type(screen.getByLabelText(/source url/i), "not-a-url");
    await user.click(screen.getByRole("button", { name: /create job/i }));

    expect(await screen.findByText(/valid http/i)).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("maps server 422 fieldErrors onto the source URL field", async () => {
    mutateAsync.mockRejectedValueOnce(
      new ApiError(422, "Validation failed", { sourceUrl: ["Server rejected this URL"] }),
    );
    const user = userEvent.setup();
    render(<JobsPage />);

    await user.type(screen.getByLabelText(/source url/i), "https://cdn.example.com/videos/movie.mp4");
    await user.click(screen.getByRole("button", { name: /create job/i }));

    expect(await screen.findByText("Server rejected this URL")).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledOnce();
  });
});
