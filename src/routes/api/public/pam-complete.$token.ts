import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pam-complete/$token")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        try {
          const { finalizePamAndCreateDraft } = await import("@/server/pam/pam-delivery");
          return Response.json({ ok: true, ...(await finalizePamAndCreateDraft(params.token)) });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
