import { createHash, randomBytes } from 'node:crypto';
import { invitationAccept, invitationCreate, invitationTokenBody, type InvitationLink } from '@calendar/shared';
import bcrypt from 'bcryptjs';
import { and, eq, gt } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { issueToken, requireAdmin, type Env } from './auth.js';
import { transaction, type CalendarDb } from './db.js';
import { pickUniqueMemberColor } from './member-colors.js';
import { readRoleLabels } from './role-labels.js';
import { invitations, members } from './schema.js';
import { getById, insert, update } from './store.js';

const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;
const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex');

function issueInvitation(db: CalendarDb, memberId: string): InvitationLink {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();
  const fields = { tokenHash: fingerprint(token), expiresAt };
  db.insert(invitations).values({ memberId, ...fields })
    .onConflictDoUpdate({ target: invitations.memberId, set: fields }).run();
  return { token, expiresAt };
}

function findInvitation(db: CalendarDb, token: string) {
  const record = db.select({
    memberId: members.id, username: members.username, name: members.name,
    role: members.role, expiresAt: invitations.expiresAt,
  }).from(invitations).innerJoin(members, eq(invitations.memberId, members.id))
    .where(and(
      eq(invitations.tokenHash, fingerprint(token)),
      gt(invitations.expiresAt, new Date().toISOString()),
      eq(members.passwordHash, ''),
      eq(members.active, false),
    )).get();
  if (!record) throw new HTTPException(410, { message: '邀请链接已失效，请联系团队管理员。' });
  return record;
}

export function publicInvitationRoutes(db: CalendarDb) {
  const app = new Hono<Env>();
  app.post('/auth/invitations/preview', async c => {
    const { token } = invitationTokenBody.parse(await c.req.json());
    const { username, name, role, expiresAt } = findInvitation(db, token);
    c.header('Cache-Control', 'no-store');
    return c.json({ username, name, roleLabel: readRoleLabels(db)[role], expiresAt });
  });
  app.post('/auth/invitations/accept', async c => {
    const { token, password } = invitationAccept.parse(await c.req.json());
    findInvitation(db, token);
    const passwordHash = await bcrypt.hash(password, 10);
    const user = transaction(db, tx => {
      const { memberId } = findInvitation(tx, token);
      tx.delete(invitations).where(eq(invitations.memberId, memberId)).run();
      return update(tx, 'members', memberId, { passwordHash, active: true });
    });
    c.header('Cache-Control', 'no-store');
    return c.json({ token: await issueToken(db, user.id, passwordHash), user });
  });
  return app;
}

export function managedInvitationRoutes(db: CalendarDb) {
  const app = new Hono<Env>();
  app.post('/members/invitations', requireAdmin, async c => {
    const { avatarColor, ...profile } = invitationCreate.parse(await c.req.json());
    const result = transaction(db, tx => {
      const member = insert(tx, 'members', {
        ...profile, avatarColor: avatarColor ?? pickUniqueMemberColor(tx), passwordHash: '', active: false,
      });
      return { member, ...issueInvitation(tx, member.id) };
    });
    c.header('Cache-Control', 'no-store');
    return c.json(result, 201);
  });
  app.post('/members/:id/invitation', requireAdmin, c => {
    const id = c.req.param('id');
    const result = transaction(db, tx => {
      if (!getById(tx, 'members', id).pendingInvitation) {
        throw new HTTPException(409, { message: '此账号已开通，无需邀请' });
      }
      return issueInvitation(tx, id);
    });
    c.header('Cache-Control', 'no-store');
    return c.json(result);
  });
  app.delete('/members/:id/invitation', requireAdmin, c => {
    db.delete(invitations).where(eq(invitations.memberId, c.req.param('id'))).run();
    return c.json({ ok: true });
  });
  return app;
}
