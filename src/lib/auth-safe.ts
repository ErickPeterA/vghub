import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TIMEOUT_MS = 10_000;
const AUTH_TIMEOUT_MS = 8_000;

export function withTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  message = "A operação demorou demais.",
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export async function getSessionSafely(): Promise<Session | null> {
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      AUTH_TIMEOUT_MS,
      "Não foi possível restaurar a sessão.",
    );
    return data.session ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUserSafely() {
  const session = await getSessionSafely();
  return session?.user ?? null;
}
