import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await import("@/server/auth/session");
          session.assertSameOrigin(request);
          await session.revokeRequestSession(request);
          return Response.json(
            { ok: true },
            { headers: { "Set-Cookie": session.clearSessionCookie() } },
          );
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});

