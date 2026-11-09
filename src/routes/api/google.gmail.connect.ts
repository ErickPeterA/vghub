import { randomBytes } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/google/gmail/connect")({ server: { handlers: { GET: async ({ request }) => {
  try {
    const [{ requireAuthenticatedUser }, { requireAdminUser }, { gmailAuthorizationUrl }] = await Promise.all([import("@/server/auth/session"), import("@/server/auth/local-user"), import("@/server/gmail/gmail-service")]);
    const user = await requireAuthenticatedUser(request); await requireAdminUser(user.userId);
    const requestedReturnTo = new URL(request.url).searchParams.get("returnTo") ?? "/projetos";
    const returnTo = /^\/projetos\/[0-9a-f-]+\/pam$/i.test(requestedReturnTo)
      ? requestedReturnTo
      : "/projetos";
    const state = randomBytes(32).toString("base64url");
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const headers = new Headers({ Location: gmailAuthorizationUrl(state) });
    headers.append("Set-Cookie", `gmail_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
    headers.append("Set-Cookie", `gmail_oauth_return_to=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
    return new Response(null, { status: 302, headers });
  } catch (error) { const { toErrorResponse } = await import("@/server/http/errors"); return toErrorResponse(error); }
} } } });
