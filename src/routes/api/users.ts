import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireAdminUser }, { listAssignableUsers }] =
            await Promise.all([
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/users/user-repository"),
            ]);
          const identity = await requireAuthenticatedUser(request);
          await requireAdminUser(identity.userId);

          return Response.json({ ok: true, users: await listAssignableUsers() });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
