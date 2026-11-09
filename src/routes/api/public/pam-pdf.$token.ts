import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/pam-pdf/$token")({ server: { handlers: { GET: async ({ params }) => {
  try { const { getPamPdf } = await import("@/server/pam/pam-delivery"); const pdf = await getPamPdf(params.token); return new Response(pdf.data, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(pdf.filename)}` } }); }
  catch (error) { const { toErrorResponse } = await import("@/server/http/errors"); return toErrorResponse(error); }
} } } });
