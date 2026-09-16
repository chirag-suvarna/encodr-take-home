import { createJobSchema } from "@/lib/schemas";
import { error, json, unprocessable, withAuth } from "@/lib/server/http";
import { createJob, listJobs } from "@/lib/server/store";

export async function GET(req: Request) {
  return withAuth(req, async () => json(listJobs()));
}

export async function POST(req: Request) {
  return withAuth(req, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error(400, "Invalid JSON");
    }

    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) return unprocessable(parsed.error);

    const title = parsed.data.title?.trim() || undefined;
    return json(createJob({ sourceUrl: parsed.data.sourceUrl, title }), 201);
  });
}
