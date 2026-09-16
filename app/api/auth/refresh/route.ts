import { issueAccessToken, verifyRefreshToken } from "@/lib/server/auth";
import { error, json } from "@/lib/server/http";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON");
  }

  const refreshToken =
    body && typeof body === "object" && "refreshToken" in body && typeof body.refreshToken === "string"
      ? body.refreshToken
      : "";

  if (!refreshToken) return error(400, "refreshToken is required");

  const userId = verifyRefreshToken(refreshToken);
  if (!userId) return error(401, "Invalid refresh token");

  return json({ accessToken: issueAccessToken(userId) });
}
