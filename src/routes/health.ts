import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { getDatabaseHealth } = await import("@/server/db/health");
          const health = await getDatabaseHealth();
          const ok = health.database === "gestao_pessoas";

          return Response.json(
            {
              status: ok ? "ok" : "error",
              database: health.database,
              now: health.now,
            },
            { status: ok ? 200 : 500 },
          );
        } catch (error) {
          console.error(error);
          return Response.json(
            { status: "error", database: null, message: "PostgreSQL indisponivel." },
            { status: 500 },
          );
        }
      },
    },
  },
});
