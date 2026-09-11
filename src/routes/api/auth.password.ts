import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/password")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const [{ z }, { query }, password, session] = await Promise.all([
            import("zod"),
            import("@/server/db/pool"),
            import("@/server/auth/password"),
            import("@/server/auth/session"),
          ]);
          session.assertSameOrigin(request);
          const identity = await session.requireAuthenticatedUser(request);
          const data = z
            .object({
              currentPassword: z.string().max(1024),
              newPassword: z.string().min(8).max(255),
            })
            .parse(await request.json());
          const result = await query<{ password_hash: string | null }>(
            `select password_hash from public.users where id = $1::uuid limit 1`,
            [identity.userId],
          );
          const valid = await password.verifyPassword(
            data.currentPassword,
            result.rows[0]?.password_hash ?? null,
          );
          if (!valid) {
            const { HttpError } = await import("@/server/http/errors");
            throw new HttpError(401, "invalid_credentials", "Senha atual invalida.");
          }

          const passwordHash = await password.hashPassword(data.newPassword);
          await query(
            `update public.users set password_hash = $2, password_changed_at = now(), updated_at = now() where id = $1::uuid`,
            [identity.userId, passwordHash],
          );
          await session.revokeAllUserSessions(identity.userId);
          const created = await session.createSession(identity.userId, request);
          return Response.json(
            { ok: true },
            { headers: { "Set-Cookie": session.createSessionCookie(created.token, created.expiresAt) } },
          );
        } catch (error) {
          const { toErrorResponse } = await import("@/server/http/errors");
          return toErrorResponse(error);
        }
      },
    },
  },
});
