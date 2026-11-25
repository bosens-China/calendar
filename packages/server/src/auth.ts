import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Member } from '@calendar/shared';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { jwtVerify, SignJWT } from 'jose';
import { findById } from './store.js';

export type Env = { Variables: { user: Member } };

function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('hex').slice(0, 16);
}

function getJwtSecret(db: DatabaseSync): Uint8Array {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0) {
    return new TextEncoder().encode(process.env.JWT_SECRET);
  }
  const existing = db
    .prepare("SELECT value FROM settings WHERE key = 'jwtSecret'")
    .get() as { value: string } | undefined;
  if (existing?.value) {
    return new TextEncoder().encode(existing.value);
  }
  const generated = randomBytes(32).toString('hex');
  db.prepare(
    "INSERT INTO settings(key, value) VALUES ('jwtSecret', ?) ON CONFLICT(key) DO NOTHING",
  ).run(generated);
  const stored = db
    .prepare("SELECT value FROM settings WHERE key = 'jwtSecret'")
    .get() as { value: string };
  return new TextEncoder().encode(stored.value);
}

export function issueToken(db: DatabaseSync, memberId: string, passwordHash: string) {
  return new SignJWT({ ver: passwordFingerprint(passwordHash) })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(memberId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret(db));
}

export const requireAuth = (db: DatabaseSync) =>
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
    const authRow = id
      ? (db
          .prepare('SELECT passwordHash, active FROM members WHERE id = ?')
          .get(id) as { passwordHash: string; active: number } | undefined)
      : undefined;
    if (
      !id ||
      !authRow ||
      !authRow.active ||
      typeof ver !== 'string' ||
      ver !== passwordFingerprint(String(authRow.passwordHash))
    ) {
      throw new HTTPException(401, { message: '登录凭证已失效，请重新登录' });
    }
    const user = findById(db, 'members', id);
    if (!user || !user.active) throw new HTTPException(401, { message: '账号不可用' });
    c.set('user', user);
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
