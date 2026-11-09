import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { query } from "@/server/db/pool";

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Google OAuth não configurado.");
  return { clientId, clientSecret, redirectUri };
}

function key() {
  const value = process.env.GOOGLE_GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error("Chave de criptografia do Gmail não configurada.");
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) throw new Error("A chave do Gmail deve ter 32 bytes em base64.");
  return decoded;
}

function encrypt(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function gmailAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "https://www.googleapis.com/auth/gmail.compose", access_type: "offline", prompt: "consent", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function connectGmail(code: string, userId: string) {
  const { clientId, clientSecret, redirectUri } = config();
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  const token = await response.json() as { refresh_token?: string; access_token?: string };
  if (!response.ok || !token.refresh_token) throw new Error("O Google não retornou um token de atualização.");
  let email: string | null = null;
  if (token.access_token) {
    const profile = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (profile.ok) email = ((await profile.json()) as { emailAddress?: string }).emailAddress ?? null;
  }
  await query(`insert into public.gmail_oauth_connection (singleton, account_email, encrypted_refresh_token, connected_by) values (true, $1, $2, $3::uuid) on conflict (singleton) do update set account_email = excluded.account_email, encrypted_refresh_token = excluded.encrypted_refresh_token, connected_by = excluded.connected_by, connected_at = now(), updated_at = now()`, [email, encrypt(token.refresh_token), userId]);
}

export async function getGmailConnectionStatus() {
  const result = await query<{ account_email: string | null; connected_at: string }>(
    `select account_email, connected_at
       from public.gmail_oauth_connection
      where singleton = true
      limit 1`,
  );
  const connection = result.rows[0];
  return {
    connected: Boolean(connection),
    accountEmail: connection?.account_email ?? null,
    connectedAt: connection?.connected_at ?? null,
  };
}

export async function disconnectGmail() {
  const result = await query<{ encrypted_refresh_token: string }>(
    `select encrypted_refresh_token
       from public.gmail_oauth_connection
      where singleton = true
      limit 1`,
  );
  const connection = result.rows[0];
  if (!connection) return { disconnected: true };

  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: decrypt(connection.encrypted_refresh_token) }),
    });
  } finally {
    await query(`delete from public.gmail_oauth_connection where singleton = true`);
  }

  return { disconnected: true };
}

async function accessToken() {
  const result = await query<{ encrypted_refresh_token: string }>(`select encrypted_refresh_token from public.gmail_oauth_connection where singleton = true`);
  if (!result.rows[0]) throw new Error("Nenhuma conta Gmail esta conectada.");
  const { clientId, clientSecret } = config();
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: decrypt(result.rows[0].encrypted_refresh_token), grant_type: "refresh_token" }) });
  const data = await response.json() as { access_token?: string };
  if (!response.ok || !data.access_token) throw new Error("Não foi possível renovar a autorização do Gmail.");
  return data.access_token;
}

export async function createGmailDraft(input: { to: string; subject: string; text: string; filename: string; pdf: Buffer }) {
  const boundary = `pam_${randomBytes(12).toString("hex")}`;
  const mime = [`To: ${input.to}`, `Subject: =?UTF-8?B?${Buffer.from(input.subject).toString("base64")}?=`, "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary=\"${boundary}\"`, "", `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(input.text).toString("base64"), `--${boundary}`, `Content-Type: application/pdf; name=\"${input.filename}\"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename=\"${input.filename}\"`, "", input.pdf.toString("base64"), `--${boundary}--`].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", { method: "POST", headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { raw: Buffer.from(mime).toString("base64url") } }) });
  const data = await response.json() as { id?: string };
  if (!response.ok || !data.id) throw new Error(`Falha ao criar rascunho no Gmail (${response.status}).`);
  return data.id;
}
