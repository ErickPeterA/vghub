import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/pam-gmail-retry/$token")({ server: { handlers: { POST: async ({ params }) => {
  try { const { createPamDraft } = await import("@/server/pam/pam-delivery"); return Response.json({ ok: true, ...(await createPamDraft(params.token)) }); }
  catch (error) { const { toErrorResponse } = await import("@/server/http/errors"); return toErrorResponse(error); }
} } } });
