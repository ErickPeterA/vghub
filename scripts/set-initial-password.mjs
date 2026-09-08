import { randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import pg from "pg";

const scrypt = promisify(nodeScrypt);

async function promptHidden(label) {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error("Este comando exige um terminal interativo para ler a senha com seguranca.");
  }
  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    const onData = (character) => {
      if (character === "\u0003") {
        cleanup();
        stdout.write("\n");
        reject(new Error("Operacao cancelada."));
      } else if (character === "\r" || character === "\n") {
        cleanup();
        stdout.write("\n");
        resolve(value);
      } else if (character === "\u007f" || character === "\b") {
        value = value.slice(0, -1);
      } else if (character >= " ") {
        value += character;
      }
    };
    stdin.on("data", onData);
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, {
    N: 32_768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$32768$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL nao esta configurada.");

const rl = createInterface({ input: stdin, output: stdout });
const email = (process.argv[2] ?? (await rl.question("E-mail do administrador: ")))
  .trim()
  .toLowerCase();
rl.close();
if (!email) throw new Error("Informe o e-mail do administrador.");

const password = await promptHidden("Nova senha (minimo 10 caracteres): ");
const confirmation = await promptHidden("Confirme a nova senha: ");
if (password.length < 10) throw new Error("A senha deve ter pelo menos 10 caracteres.");
if (password !== confirmation) throw new Error("As senhas nao conferem.");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
try {
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `
      update public.users u
      set password_hash = $2, password_changed_at = now(), updated_at = now()
      where lower(u.email) = $1
        and exists (
          select 1 from public.user_roles ur
          where ur.user_id = u.id and ur.role = 'admin'::public.app_role
        )
      returning u.id
    `,
    [email, passwordHash],
  );
  if (result.rowCount !== 1) throw new Error("Administrador nao encontrado para esse e-mail.");
  await pool.query(
    `update public.auth_sessions set revoked_at = coalesce(revoked_at, now()) where user_id = $1::uuid and revoked_at is null`,
    [result.rows[0].id],
  );
  stdout.write("Senha local definida e sessoes anteriores revogadas.\n");
} finally {
  await pool.end();
}
