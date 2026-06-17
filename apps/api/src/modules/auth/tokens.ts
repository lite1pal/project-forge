import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export interface TokenHashOptions {
  secret: string;
}

export function createOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashToken(token: string, options: TokenHashOptions): string {
  return createHash("sha256")
    .update(`${options.secret}:${token}`)
    .digest("hex");
}

export function verifyTokenHash(
  token: string,
  expectedHash: string,
  options: TokenHashOptions
): boolean {
  const actualHash = hashToken(token, options);
  const actual = Buffer.from(actualHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
