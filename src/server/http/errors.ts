export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }

  if (error instanceof Error && error.name === "ZodError") {
    return Response.json({ error: "invalid_body", message: "Payload invalido." }, { status: 400 });
  }

  console.error(error);
  return Response.json(
    { error: "server_error", message: "Erro interno do servidor." },
    { status: 500 },
  );
}
