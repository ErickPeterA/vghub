import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pam/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { getPublicPamPageData } = await import("@/server/pam/pam-repository");
          return Response.json({ ok: true, ...(await getPublicPamPageData(params.token)) });
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
