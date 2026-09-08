import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/navigation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const [{ requireAuthenticatedUser }, { requireLocalUser }, { getGlobalNavigationPermissions }] =
            await Promise.all([
            import("@/server/auth/session"),
              import("@/server/auth/local-user"),
              import("@/server/navigation/navigation-repository"),
            ]);
          const user = await requireAuthenticatedUser(request);
          await requireLocalUser(user.userId);
          return Response.json({ ok: true, ...(await getGlobalNavigationPermissions(user.userId)) });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
