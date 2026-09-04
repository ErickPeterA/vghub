import { getSessionSafely, withTimeout } from "@/lib/auth-safe";

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  timeoutMs?: number;
};

export async function apiFetch(path: string, options: ApiFetchOptions = {}) {
  const session = await getSessionSafely();
  if (!session?.access_token) {
    throw new Error("Sessao expirada. Entre novamente.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return withTimeout(
    fetch(path, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    options.timeoutMs ?? 10_000,
    "Nao foi possivel comunicar com a API.",
  );
}

export async function apiJson<T>(path: string, options: ApiFetchOptions = {}) {
  const response = await apiFetch(path, options);
  const payload = (await response.json().catch(() => null)) as (T & { message?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Erro na API.");
  }

  return payload as T;
}
