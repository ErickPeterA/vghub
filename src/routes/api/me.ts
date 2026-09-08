import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const [{ requireAuthenticatedUser }, { getLocalUserById }] = await Promise.all([
            import("@/server/auth/session"),
            import("@/server/users/user-repository"),
          ]);
          const identity = await requireAuthenticatedUser(request);
          const localUser = await getLocalUserById(identity.userId);

          return Response.json({
            ok: true,
            identity,
            localUser,
            permissions: {
              provisioned: !!localUser,
              isAdmin: !!localUser?.isAdmin,
            },
          });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
