const DEFAULT_TIMEOUT_MS = 10_000;
const AUTH_TIMEOUT_MS = 8_000;

export type LocalSession = {
  user: { id: string; email: string };
  expiresAt: string;
};

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

export async function getSessionSafely(): Promise<LocalSession | null> {
  try {
    const response = await withTimeout(
      fetch("/api/auth/session", { credentials: "same-origin" }),
      AUTH_TIMEOUT_MS,
      "Não foi possível restaurar a sessão.",
    );
    if (!response.ok) return null;
    return (await response.json()) as LocalSession;
  } catch {
    return null;
  }
}

export async function getCurrentUserSafely() {
  const session = await getSessionSafely();
  return session?.user ?? null;
}
