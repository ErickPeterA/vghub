import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/pam-gmail-retry/$token")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        try {
          return Response.json(
            {
              error: "gone",
              message: "O envio do resultado do PAM por Gmail não está mais disponível.",
            },
            { status: 410 },
          );
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
