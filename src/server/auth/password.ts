import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
const KEY_LENGTH = 64;
const COST = 32_768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const MAX_MEMORY = 64 * 1024 * 1024;
const PREFIX = "scrypt";

function scrypt(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });

  return [
    PREFIX,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64"),
    derivedKey.toString("base64"),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string | null) {
  if (!encodedHash) return false;

  const [prefix, costRaw, blockSizeRaw, parallelizationRaw, saltRaw, expectedRaw] =
    encodedHash.split("$");
  const cost = Number(costRaw);
  const blockSize = Number(blockSizeRaw);
  const parallelization = Number(parallelizationRaw);

  if (
    prefix !== PREFIX ||
    !Number.isSafeInteger(cost) ||
    !Number.isSafeInteger(blockSize) ||
    !Number.isSafeInteger(parallelization) ||
    cost < 2 ||
    (cost & (cost - 1)) !== 0 ||
    blockSize < 1 ||
    parallelization < 1 ||
    !saltRaw ||
    !expectedRaw
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(saltRaw, "base64");
    const expected = Buffer.from(expectedRaw, "base64");
    if (salt.length < 16 || expected.length !== KEY_LENGTH) return false;

    const actual = await scrypt(password, salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem: MAX_MEMORY,
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
