import { authMagicLinks, authSessions, users } from "@auditrail/db/schema";
import { desc, eq } from "drizzle-orm";

import type { AppDatabase } from "../../plugins/database.js";
import type {
  AuthRepo,
  AuthSession,
  AuthUser,
  MagicLinkRecord
} from "./service.js";

export function createPostgresAuthRepo(db: AppDatabase): AuthRepo {
  return {
    async consumeMagicLink(id, consumedAt) {
      await db
        .update(authMagicLinks)
        .set({
          consumedAt: new Date(consumedAt)
        })
        .where(eq(authMagicLinks.id, id));
    },
    async createMagicLink(input) {
      const [record] = await db
        .insert(authMagicLinks)
        .values({
          email: input.email,
          expiresAt: new Date(input.expiresAt),
          tokenHash: input.tokenHash
        })
        .returning();

      return toMagicLinkRecord(record);
    },
    async createSession(input) {
      const [record] = await db
        .insert(authSessions)
        .values({
          expiresAt: new Date(input.expiresAt),
          tokenHash: input.tokenHash,
          userId: input.userId
        })
        .returning();

      return toAuthSession(record);
    },
    async findMagicLinkByEmail(email) {
      const [record] = await db
        .select()
        .from(authMagicLinks)
        .where(eq(authMagicLinks.email, email))
        .orderBy(desc(authMagicLinks.createdAt))
        .limit(1);

      return record ? toMagicLinkRecord(record) : undefined;
    },
    async findOrCreateUserByEmail(email) {
      const existing = await findUserByEmail(db, email);

      if (existing) {
        return existing;
      }

      const [record] = await db
        .insert(users)
        .values({
          email
        })
        .returning();

      return toAuthUser(record);
    },
    async findSessionByHash(tokenHash) {
      const [record] = await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.tokenHash, tokenHash))
        .limit(1);

      return record ? toAuthSession(record) : undefined;
    },
    async findUserById(id) {
      const [record] = await db.select().from(users).where(eq(users.id, id)).limit(1);

      return record ? toAuthUser(record) : undefined;
    },
    async revokeSession(id, revokedAt) {
      await db
        .update(authSessions)
        .set({
          revokedAt: new Date(revokedAt)
        })
        .where(eq(authSessions.id, id));
    }
  };
}

async function findUserByEmail(
  db: AppDatabase,
  email: string
): Promise<AuthUser | undefined> {
  const [record] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return record ? toAuthUser(record) : undefined;
}

function toAuthUser(record: typeof users.$inferSelect): AuthUser {
  return {
    email: record.email,
    id: record.id,
    name: record.name ?? undefined
  };
}

function toAuthSession(record: typeof authSessions.$inferSelect): AuthSession {
  return {
    expiresAt: record.expiresAt.toISOString(),
    id: record.id,
    revokedAt: record.revokedAt?.toISOString(),
    tokenHash: record.tokenHash,
    userId: record.userId
  };
}

function toMagicLinkRecord(
  record: typeof authMagicLinks.$inferSelect
): MagicLinkRecord {
  return {
    consumedAt: record.consumedAt?.toISOString(),
    email: record.email,
    expiresAt: record.expiresAt.toISOString(),
    id: record.id,
    tokenHash: record.tokenHash
  };
}
