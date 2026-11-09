import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/google/gmail/disconnect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireAdminUser }, { disconnectGmail }] =
            await Promise.all([
              import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/gmail/gmail-service"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireAdminUser(user.userId);
          return Response.json({ ok: true, ...(await disconnectGmail()) });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
