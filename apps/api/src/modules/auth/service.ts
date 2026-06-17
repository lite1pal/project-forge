import { z } from "zod";

import { createOpaqueToken, hashToken, verifyTokenHash } from "./tokens.js";

const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface MagicLinkRecord {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  consumedAt?: string;
}

export interface AuthRepo {
  createMagicLink(input: Omit<MagicLinkRecord, "id">): Promise<MagicLinkRecord>;
  findMagicLinkByEmail(email: string): Promise<MagicLinkRecord | undefined>;
  consumeMagicLink(id: string, consumedAt: string): Promise<void>;
  findOrCreateUserByEmail(email: string): Promise<AuthUser>;
  findUserById(id: string): Promise<AuthUser | undefined>;
  createSession(input: Omit<AuthSession, "id">): Promise<AuthSession>;
  findSessionByHash(tokenHash: string): Promise<AuthSession | undefined>;
  revokeSession(id: string, revokedAt: string): Promise<void>;
}

export interface MagicLinkSender {
  sendMagicLink(input: { email: string; token: string }): Promise<void>;
}

export interface AuthServiceOptions {
  magicLinkTtlMs: number;
  sessionTtlMs: number;
  tokenSecret: string;
  now?: () => Date;
}

export interface AuthService {
  requestMagicLink(email: string): Promise<void>;
  createSessionFromMagicLink(token: string, email: string): Promise<{
    session: AuthSession;
    sessionToken: string;
    user: AuthUser;
  }>;
  revokeSession(sessionToken: string): Promise<void>;
  getSessionUser(sessionToken: string): Promise<AuthUser | undefined>;
}

export function createAuthService(
  repo: AuthRepo,
  sender: MagicLinkSender,
  options: AuthServiceOptions
): AuthService {
  const now = options.now ?? (() => new Date());

  return {
    async requestMagicLink(rawEmail) {
      const email = emailSchema.parse(rawEmail);
      const token = createOpaqueToken();
      const createdAt = now();
      const expiresAt = new Date(
        createdAt.getTime() + options.magicLinkTtlMs
      ).toISOString();

      await repo.createMagicLink({
        email,
        expiresAt,
        tokenHash: hashToken(token, { secret: options.tokenSecret })
      });
      await sender.sendMagicLink({ email, token });
    },
    async createSessionFromMagicLink(token, rawEmail) {
      const email = emailSchema.parse(rawEmail);
      const magicLink = await repo.findMagicLinkByEmail(email);
      const currentTime = now();

      if (
        !magicLink ||
        magicLink.consumedAt ||
        magicLink.expiresAt < currentTime.toISOString() ||
        !verifyTokenHash(token, magicLink.tokenHash, {
          secret: options.tokenSecret
        })
      ) {
        throw new Error("invalid_magic_link");
      }

      const user = await repo.findOrCreateUserByEmail(email);
      const sessionToken = createOpaqueToken();
      const session = await repo.createSession({
        expiresAt: new Date(
          currentTime.getTime() + options.sessionTtlMs
        ).toISOString(),
        tokenHash: hashToken(sessionToken, { secret: options.tokenSecret }),
        userId: user.id
      });

      await repo.consumeMagicLink(magicLink.id, currentTime.toISOString());

      return {
        session,
        sessionToken,
        user
      };
    },
    async revokeSession(sessionToken) {
      const session = await repo.findSessionByHash(
        hashToken(sessionToken, { secret: options.tokenSecret })
      );

      if (session && !session.revokedAt) {
        await repo.revokeSession(session.id, now().toISOString());
      }
    },
    async getSessionUser(sessionToken) {
      const session = await repo.findSessionByHash(
        hashToken(sessionToken, { secret: options.tokenSecret })
      );

      if (!session || session.revokedAt || session.expiresAt < now().toISOString()) {
        return undefined;
      }

      return repo.findUserById(session.userId);
    }
  };
}
