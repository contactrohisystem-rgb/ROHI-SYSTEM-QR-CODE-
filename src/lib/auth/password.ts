import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing using Node's built-in scrypt KDF.
 *
 * Why scrypt (and not bcrypt):
 * - No external/native dependency to compile.
 * - Memory-hard, modern, considered secure for password storage.
 * - Available in both Node and Bun runtimes via node:crypto.
 *
 * Stored format: "scrypt:<saltHex>:<hashHex>"
 * The scheme prefix lets us migrate to a different KDF later while still
 * verifying legacy hashes.
 */

const KEY_LEN = 64;
const SALT_LEN = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    if (expected.length !== KEY_LEN) return false;
    const actual = scryptSync(password, salt, KEY_LEN);
    // timingSafeEqual requires equal-length buffers; both are KEY_LEN here.
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
