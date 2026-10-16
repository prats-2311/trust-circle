import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_BYTES = 32;

export function normaliseSafeWord(s: string): string {
  return s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function validateSafeWord(s: string): string | null {
  const n = normaliseSafeWord(s);
  if (n.length < 3) return "Please choose a safe word with at least 3 letters.";
  if (n.length > 40) return "Please choose a safe word of 40 letters or fewer.";
  return null;
}

export async function hashSafeWord(s: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(normaliseSafeWord(s), salt, KEY_BYTES);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifySafeWord(s: string, stored: string): Promise<boolean> {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await scryptAsync(normaliseSafeWord(s), Buffer.from(salt, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
