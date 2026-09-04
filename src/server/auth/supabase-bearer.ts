import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ensureServerEnvLoaded } from "@/server/env";
import { HttpError } from "@/server/http/errors";

export type AuthenticatedApiUser = {
  userId: string;
  email: string | null;
};

function getSupabaseAuthEnv() {
  ensureServerEnvLoaded();
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase Auth environment variables are not configured");
  }

  return { url, publishableKey };
}

export async function requireAuthenticatedUser(request: Request): Promise<AuthenticatedApiUser> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "unauthorized", "Sessao ausente ou expirada.");
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new HttpError(401, "unauthorized", "Sessao ausente ou expirada.");
  }

  const { url, publishableKey } = getSupabaseAuthEnv();
  const supabase = createClient<Database>(url, publishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) {
    throw new HttpError(401, "unauthorized", "Sessao ausente ou expirada.");
  }

  return {
    userId,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
}

export const requireSupabaseBearerUser = requireAuthenticatedUser;
