import { beforeEach, describe, expect, it } from "vitest";
import { GET as getJobById } from "@/app/api/jobs/[id]/route";
import { GET as listJobs, POST as createJobRoute } from "@/app/api/jobs/route";
import { createJobSchema, sourceUrlSchema } from "@/lib/schemas";
import { issueAccessToken } from "@/lib/server/auth";
import { FAIL_URL, resetStore } from "@/lib/server/store";

beforeEach(() => {
  resetStore();
});

function authHeaders() {
  return { authorization: `Bearer ${issueAccessToken("u_demo")}` };
}

function postJob(body: unknown, authed = true) {
  return createJobRoute(
    new Request("http://localhost/api/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authed ? authHeaders() : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function list(authed = true) {
  return listJobs(
    new Request("http://localhost/api/jobs", {
      headers: authed ? authHeaders() : {},
    }),
  );
}

function getById(id: string, authed = true) {
  return getJobById(
    new Request(`http://localhost/api/jobs/${id}`, {
      headers: authed ? authHeaders() : {},
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("sourceUrlSchema", () => {
  it.each([
    "https://cdn.example.com/videos/movie.mp4",
    "http://cdn.example.com/videos/movie.mp4",
    FAIL_URL,
  ])("accepts %s", (url) => {
    expect(sourceUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each(["not-a-url", "ftp://example.com/video.mp4", "example.com", "", "https://example.com"])(
    "rejects %s",
    (url) => {
      expect(sourceUrlSchema.safeParse(url).success).toBe(false);
    },
  );
});

describe("job APIs", () => {
  it("requires auth on list, create, and get-by-id", async () => {
    expect((await list(false)).status).toBe(401);
    expect((await postJob({ sourceUrl: "https://example.com/video.mp4" }, false)).status).toBe(401);
    expect((await getById("j_missing", false)).status).toBe(401);
  });

  it("creates a job and returns it with status NEW", async () => {
    const res = await postJob({
      sourceUrl: "https://example.com/video.mp4",
      title: "My Video",
    });
    expect(res.status).toBe(201);
    const job = await res.json();
    expect(job.id).toMatch(/^j_/);
    expect(job.title).toBe("My Video");
    expect(job.sourceUrl).toBe("https://example.com/video.mp4");
    expect(job.status).toBe("NEW");
    expect(job.createdAt).toBeTruthy();
  });

  it("derives a title from the URL when title is omitted", async () => {
    const res = await postJob({ sourceUrl: "https://cdn.example.com/videos/clip.mp4" });
    expect(res.status).toBe(201);
    expect((await res.json()).title).toBe("clip.mp4");
  });

  it("returns 422 field errors for a bad source URL", async () => {
    for (const sourceUrl of ["not-a-url", "ftp://example.com/video.mp4", "example.com"]) {
      const res = await postJob({ sourceUrl });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.fieldErrors.sourceUrl?.length).toBeGreaterThan(0);
    }
    expect(createJobSchema.safeParse({ sourceUrl: "" }).success).toBe(false);
  });

  it("lists jobs newest first and fetches one by id", async () => {
    const first = await (await postJob({ sourceUrl: "https://example.com/a.mp4", title: "A" })).json();
    const second = await (await postJob({ sourceUrl: "https://example.com/b.mp4", title: "B" })).json();

    const listed = await list();
    expect(listed.status).toBe(200);
    const jobs = await listed.json();
    expect(jobs.map((j: { id: string }) => j.id)).toEqual([second.id, first.id]);

    const got = await getById(first.id);
    expect(got.status).toBe(200);
    expect((await got.json()).title).toBe("A");
  });

  it("returns 404 for an unknown job id", async () => {
    const res = await getById("j_missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: "Job not found" });
  });
});
