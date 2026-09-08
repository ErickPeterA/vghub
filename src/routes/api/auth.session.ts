import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { requireAuthenticatedUser } = await import("@/server/auth/session");
          const identity = await requireAuthenticatedUser(request);
          return Response.json({
            user: { id: identity.userId, email: identity.email },
            expiresAt: identity.expiresAt,
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});

