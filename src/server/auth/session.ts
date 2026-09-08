import { createHash, randomBytes } from "node:crypto";
import { query } from "@/server/db/pool";
import { HttpError } from "@/server/http/errors";

export const SESSION_COOKIE_NAME = "vghub_session";
const DEFAULT_SESSION_TTL_HOURS = 168;

export type AuthenticatedApiUser = {
  userId: string;
  email: string;
  expiresAt: string;
};

function sessionTtlHours() {
  const configured = Number(process.env.AUTH_SESSION_TTL_HOURS ?? DEFAULT_SESSION_TTL_HOURS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SESSION_TTL_HOURS;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }
  return null;
}

function cookieAttributes(maxAge: number) {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
  ];
}

export function createSessionCookie(token: string, expiresAt: Date) {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  const attributes = cookieAttributes(maxAge);
  attributes[0] = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`;
  attributes.push(`Expires=${expiresAt.toUTCString()}`);
  return attributes.join("; ");
}

export function clearSessionCookie() {
  const attributes = cookieAttributes(0);
  attributes.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  return attributes.join("; ");
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, "invalid_origin", "Origem da requisicao nao permitida.");
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") {
    throw new HttpError(403, "invalid_origin", "Origem da requisicao nao permitida.");
  }
}

export async function createSession(
  userId: string,
  request: Request,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlHours() * 60 * 60 * 1000);
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  await query(
    `
      insert into public.auth_sessions
        (user_id, token_hash, expires_at, user_agent, ip_address)
      values ($1::uuid, $2, $3, $4, $5)
    `,
    [
      userId,
      hashSessionToken(token),
      expiresAt,
      request.headers.get("user-agent")?.slice(0, 1000) ?? null,
      forwardedFor,
    ],
  );

  return { token, expiresAt };
}

export async function revokeRequestSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) return;
  await query(
    `update public.auth_sessions set revoked_at = coalesce(revoked_at, now()) where token_hash = $1`,
    [hashSessionToken(token)],
  );
}

export async function revokeAllUserSessions(userId: string) {
  await query(
    `update public.auth_sessions set revoked_at = coalesce(revoked_at, now()) where user_id = $1::uuid and revoked_at is null`,
    [userId],
  );
}

export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedApiUser> {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) throw new HttpError(401, "unauthorized", "Sessao ausente ou expirada.");

  const result = await query<{ user_id: string; email: string; expires_at: Date | string }>(
    `
      select s.user_id, u.email, s.expires_at
      from public.auth_sessions s
      join public.users u on u.id = s.user_id
      where s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and u.status = 'ativo'::public.user_status
      limit 1
    `,
    [hashSessionToken(token)],
  );
  const session = result.rows[0];
  if (!session) throw new HttpError(401, "unauthorized", "Sessao ausente ou expirada.");
  const expiresAt =
    session.expires_at instanceof Date ? session.expires_at : new Date(session.expires_at);
  if (!Number.isFinite(expiresAt.getTime())) {
    throw new HttpError(401, "unauthorized", "Sessao ausente ou expirada.");
  }

  return {
    userId: session.user_id,
    email: session.email,
    expiresAt: expiresAt.toISOString(),
  };
}
