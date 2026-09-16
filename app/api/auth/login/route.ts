import { z } from "zod";
import { loginSchema } from "@/lib/schemas";
import { authenticate, issueTokens } from "@/lib/server/auth";
import { error, json } from "@/lib/server/http";

function fieldErrorsFromZod(zodError: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of zodError.issues) {
    const key = String(issue.path[0] ?? "_root");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(400, "Invalid JSON");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return json({ fieldErrors: fieldErrorsFromZod(parsed.error) }, 422);
  }

  const user = authenticate(parsed.data.email, parsed.data.password);
  if (!user) return error(401, "Invalid email or password");

  const tokens = issueTokens(user.id);
  return json({ ...tokens, user });
}
