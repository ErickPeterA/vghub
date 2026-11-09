import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

function cookie(request: Request, name: string) { return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? ""; }
function same(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }

export const Route = createFileRoute("/api/google/gmail/callback")({ server: { handlers: { GET: async ({ request }) => {
  try {
    const url = new URL(request.url); const code = url.searchParams.get("code") ?? ""; const state = url.searchParams.get("state") ?? "";
    if (!code || !state || !same(state, cookie(request, "gmail_oauth_state"))) return new Response("Estado OAuth inválido.", { status: 400 });
    const [{ requireAuthenticatedUser }, { requireAdminUser }, { connectGmail }] = await Promise.all([import("@/server/auth/session"), import("@/server/auth/local-user"), import("@/server/gmail/gmail-service")]);
    const user = await requireAuthenticatedUser(request); await requireAdminUser(user.userId); await connectGmail(code, user.userId);
    const storedReturnTo = decodeURIComponent(cookie(request, "gmail_oauth_return_to") || "/projetos");
    const returnTo = /^\/projetos\/[0-9a-f-]+\/pam$/i.test(storedReturnTo) ? storedReturnTo : "/projetos";
    const headers = new Headers({ Location: returnTo });
    headers.append("Set-Cookie", "gmail_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    headers.append("Set-Cookie", "gmail_oauth_return_to=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    return new Response(null, { status: 302, headers });
  } catch { return new Response("Não foi possível conectar o Gmail.", { status: 500 }); }
} } } });
