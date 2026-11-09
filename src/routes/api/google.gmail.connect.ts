import { randomBytes } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/google/gmail/connect")({ server: { handlers: { GET: async ({ request }) => {
  try {
    const [{ requireAuthenticatedUser }, { requireAdminUser }, { gmailAuthorizationUrl }] = await Promise.all([import("@/server/auth/session"), import("@/server/auth/local-user"), import("@/server/gmail/gmail-service")]);
    const user = await requireAuthenticatedUser(request); await requireAdminUser(user.userId);
    const state = randomBytes(32).toString("base64url");
    return new Response(null, { status: 302, headers: { Location: gmailAuthorizationUrl(state), "Set-Cookie": `gmail_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${process.env.NODE_ENV === "production" ? "; Secure" : ""}` } });
  } catch (error) { const { toErrorResponse } = await import("@/server/http/errors"); return toErrorResponse(error); }
} } } });
