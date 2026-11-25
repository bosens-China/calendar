import { createHash, randomBytes } from 'node:crypto';
import type { CalendarDb } from './db.js';
import type { Member } from '@calendar/shared';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { jwtVerify, SignJWT } from 'jose';
import { eq } from 'drizzle-orm';
import { members, settings } from './schema.js';
import { getSetting, publicMember } from './store.js';

export type Env = { Variables: { user: Member } };

function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

function getJwtSecret(db: CalendarDb): Uint8Array {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return new TextEncoder().encode(process.env.JWT_SECRET);
  }
  let secret = getSetting(db, 'jwtSecret');
  if (!secret) {
    db.insert(settings).values({ key: 'jwtSecret', value: randomBytes(32).toString('hex') })
      .onConflictDoNothing().run();
    secret = getSetting(db, 'jwtSecret');
  }
  if (!secret) throw new Error('登录签名密钥未初始化');
  return new TextEncoder().encode(secret);
}

export function issueToken(db: CalendarDb, memberId: string, passwordHash: string) {
  return new SignJWT({ ver: passwordFingerprint(passwordHash) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(memberId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret(db));
}

export const requireAuth = (db: CalendarDb) =>
  createMiddleware<Env>(async (c, next) => {
    const token = /^Bearer (\S+)$/i.exec(c.req.header('Authorization') ?? '')?.[1];
    if (!token) throw new HTTPException(401, { message: '请先登录' });
    let id: string | undefined;
    let ver: unknown;
    try {
      const { payload } = await jwtVerify(token, getJwtSecret(db), {
        algorithms: ['HS256'],
        requiredClaims: ['sub', 'exp'],
      });
      id = payload.sub;
      ver = payload.ver;
    } catch {
      throw new HTTPException(401, { message: '登录凭证无效或已过期' });
    }
    const authRow = id ? db.select().from(members).where(eq(members.id, id)).get() : undefined;
    if (!authRow?.active || typeof ver !== 'string' || ver !== passwordFingerprint(authRow.passwordHash)) {
      throw new HTTPException(401, { message: '登录凭证已失效，请重新登录' });
    }
    c.set('user', publicMember(authRow));
    await next();
  });

export const requireAdmin = createMiddleware<Env>(async (c, next) => {
  if (c.get('user').role !== 'admin') throw new HTTPException(403, { message: '需要管理员权限' });
  await next();
});

export function scopedMember(user: Member, requested?: string) {
  return user.role === 'admin' ? requested : user.id;
}

export function requireOwner(user: Member, ownerId: string) {
  if (user.role !== 'admin' && user.id !== ownerId) {
    throw new HTTPException(403, { message: '只能修改自己的记录' });
  }
}
