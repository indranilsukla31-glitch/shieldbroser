import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { anonUsers } from "../db/schema.js";

export const SESSION_COOKIE = "artei_anon";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

declare module "fastify" {
  interface FastifyRequest {
    anonId?: string;
  }
}

/**
 * Anonymous identity: a random UUID in a signed, httpOnly cookie. No login
 * needed; the ID keys likes, saved cards and per-user rate limits.
 */
export function makeEnsureAnon(db: Db, secureCookies: boolean) {
  return async function ensureAnon(req: FastifyRequest, reply: FastifyReply) {
    const raw = req.cookies[SESSION_COOKIE];
    if (raw) {
      const un = req.unsignCookie(raw);
      if (un.valid && un.value) {
        const exists = db.select().from(anonUsers).where(eq(anonUsers.id, un.value)).get();
        if (exists) {
          req.anonId = un.value;
          return;
        }
      }
    }
    const id = randomUUID();
    db.insert(anonUsers).values({ id, createdAt: Date.now() }).run();
    req.anonId = id;
    reply.setCookie(SESSION_COOKIE, id, {
      signed: true,
      httpOnly: true,
      sameSite: "lax",
      // Plain-HTTP LAN access (e.g. the Android app talking to a home PC) needs a non-secure cookie.
      secure: secureCookies && req.protocol === "https",
      path: "/",
      maxAge: ONE_YEAR_S,
    });
  };
}
