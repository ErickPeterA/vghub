import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { HttpError } from "@/server/http/errors";
import { requireAuthenticatedUser } from "@/server/auth/session";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const request = getRequest();
  if (!request) throw new HttpError(401, "unauthorized", "Sessao ausente ou expirada.");

  const identity = await requireAuthenticatedUser(request);
  return next({ context: identity });
});

