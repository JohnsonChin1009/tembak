import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { config } from "@/lib/config";

// Secrets at rest (connector tokens, API header values). The key is derived from
// SESSION_SECRET, so rotating that secret means reconnecting Notion and Linear.

const PREFIX = "enc:v1:";
let cachedKey: Buffer | undefined;

function key(): Buffer {
  cachedKey ??= Buffer.from(hkdfSync("sha256", config().sessionSecret, "tembak", "tembak:secrets:v1", 32));
  return cachedKey;
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** AES-256-GCM: "enc:v1:" + base64url(iv | ciphertext | tag). */
export function seal(plain: string): string {
  if (isSealed(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64url");
}

/** Plaintext values (stored before encryption existed) pass through unchanged. */
export function unseal(value: string): string {
  if (!isSealed(value)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([decipher.update(raw.subarray(12, raw.length - 16)), decipher.final()]).toString("utf8");
}
