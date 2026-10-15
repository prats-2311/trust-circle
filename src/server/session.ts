import { createHmac, timingSafeEqual } from "node:crypto";

function mac(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function signSession(userId: string, secret: string): string {
  return `${userId}.${mac(userId, secret)}`;
}

export function verifySession(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(userId, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}
