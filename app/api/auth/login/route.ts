import { loginSchema } from "@/lib/schemas";
import { authenticate, issueTokens } from "@/lib/server/auth";
import { error, json, unprocessable } from "@/lib/server/http";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return unprocessable(parsed.error);

  const user = authenticate(parsed.data.email, parsed.data.password);
  if (!user) return error(401, "Invalid email or password");

  const tokens = issueTokens(user.id);
  return json({ ...tokens, user });
}
