import { error, json, withAuth } from "@/lib/server/http";
import { getRun } from "@/lib/server/store";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params;
    const run = getRun(id);
    if (!run) return error(404, "Run not found");
    return json(run);
  });
}
