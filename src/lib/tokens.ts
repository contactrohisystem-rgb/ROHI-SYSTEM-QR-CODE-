import { randomBytes } from "node:crypto";

/**
 * Generates an opaque, unguessable token with an optional prefix.
 *
 * Used for QR table tokens and similar opaque identifiers that must not
 * reveal any business data. The token carries NO bill id, amount, or
 * authorization — the backend resolves token -> resource on every request.
 *
 * 16 random bytes (128 bits) is cryptographically unguessable.
 */
export function generateOpaqueToken(prefix: string, bytes = 16): string {
  return `${prefix}_${randomBytes(bytes).toString("hex")}`;
}
