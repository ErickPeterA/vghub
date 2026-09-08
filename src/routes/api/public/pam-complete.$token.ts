import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pam-complete/$token")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        try {
          const { completePublicPam } = await import("@/server/pam/pam-repository");
          return Response.json({ ok: true, ...(await completePublicPam(params.token)) });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
