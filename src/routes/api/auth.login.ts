import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/login")({
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
          const data = z
            .object({ email: z.string().trim().email().max(320), password: z.string().max(1024) })
            .parse(await request.json());
          const email = data.email.toLowerCase();
          const result = await query<{ id: string; password_hash: string | null }>(
            `select id, password_hash from public.users where lower(email) = $1 and status = 'ativo'::public.user_status limit 1`,
            [email],
          );
          const user = result.rows[0];
          const verificationHash = user?.password_hash ?? (await password.hashPassword("invalid-login"));
          const valid = await password.verifyPassword(data.password, verificationHash);

          if (!user || !valid) {
            const { HttpError } = await import("@/server/http/errors");
            throw new HttpError(401, "invalid_credentials", "E-mail ou senha invalidos.");
          }

          await session.revokeRequestSession(request);
          const created = await session.createSession(user.id, request);
          await query(`update public.users set last_login_at = now() where id = $1::uuid`, [user.id]);

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

