import { startRunSchema } from "@/lib/schemas";
import { error, json, unprocessable, withAuth } from "@/lib/server/http";
import { startRun } from "@/lib/server/store";

export async function POST(req: Request) {
  return withAuth(req, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return error(400, "Invalid JSON");
    }

    const parsed = startRunSchema.safeParse(body);
    if (!parsed.success) return unprocessable(parsed.error);

    const record = startRun(parsed.data.jobId);
    if (!record) return error(404, "Job not found");
    return json({ runId: record.id }, 201);
  });
}
