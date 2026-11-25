import type { CalendarDb } from './db.js';
import bcrypt from 'bcryptjs';
import { and, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { issueToken, requireAdmin, scopedMember, type Env } from './auth.js';
import { transaction } from './db.js';
import { getById, insert, listMembers, listProjects, publicMember, remove, update } from './store.js';
import { members, tasks } from './schema.js';
import { pickUniqueMemberColor } from './member-colors.js';
import { forgotPasswordSchema, loginBody, memberCreate, memberPatch, memberPasswordBody,
  passwordChangeBody, profilePatch, projectCreate, projectPatch } from '@calendar/shared';

export function loginRoute(db: CalendarDb) {
  const app = new Hono<Env>();
  app.post('/auth/login', async c => {
    const input = loginBody.parse(await c.req.json());
    const row = db.select().from(members)
      .where(and(eq(members.username, input.username), eq(members.active, true))).get();
    if (!row || !await bcrypt.compare(input.password, String(row.passwordHash))) {
      throw new HTTPException(401, { message: '用户名或密码错误' });
    }
    return c.json({ token: await issueToken(db, row.id, row.passwordHash), user: publicMember(row) });
  });
  app.post('/auth/forgot-password', async c => {
    const input = forgotPasswordSchema.parse(await c.req.json());
    const row = db.select().from(members)
      .where(and(eq(members.username, input.username), eq(members.active, true))).get();
    if (
      !row ||
      row.role === 'admin' ||
      !row.email ||
      row.email.trim().toLowerCase() !== input.email.toLowerCase()
    ) {
      throw new HTTPException(400, { message: '账号或绑定邮箱不匹配，请核对后重试或联系管理员' });
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    db.update(members).set({ passwordHash, updatedAt: new Date().toISOString() })
      .where(and(eq(members.id, row.id), eq(members.email, row.email), eq(members.role, 'member'), eq(members.active, true))).run();
    return c.json({ ok: true });
  });
  return app;
}

export function accountRoutes(db: CalendarDb) {
  const app = new Hono<Env>();
  app.get('/auth/me', c => c.json({ user: c.get('user') }));
  app.patch('/auth/me', async c => {
    const fields = profilePatch.parse(await c.req.json());
    return c.json({ user: update(db, 'members', c.get('user').id, fields) });
  });
  app.post('/auth/change-password', async c => {
    const { oldPassword, newPassword } = passwordChangeBody.parse(await c.req.json());
    const id = c.get('user').id;
    const row = db.select({ passwordHash: members.passwordHash }).from(members).where(eq(members.id, id)).get();
    const oldHash = row?.passwordHash;
    if (!oldHash || !await bcrypt.compare(oldPassword, String(oldHash))) throw new HTTPException(400, { message: '原密码错误' });
    const hash = await bcrypt.hash(newPassword, 10);
    const result = db.update(members).set({ passwordHash: hash, updatedAt: new Date().toISOString() })
      .where(and(eq(members.id, id), eq(members.passwordHash, oldHash))).run();
    if (!result.changes) throw new HTTPException(409, { message: '账号已变更，请重新登录' });
    return c.json({ ok: true });
  });
  app.get('/members', c => c.json(listMembers(db, scopedMember(c.get('user')))));
  app.post('/members', requireAdmin, async c => {
    const { password: initialPassword, avatarColor, ...fields } = memberCreate.parse(await c.req.json());
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const assignedColor = avatarColor ?? pickUniqueMemberColor(db);
    return c.json(insert(db, 'members', { ...fields, avatarColor: assignedColor, passwordHash, active: true }), 201);
  });

  function protectLastAdmin(db: CalendarDb, id: string) {
    const member = getById(db, 'members', id);
    if (member.active && member.role === 'admin' && !db.select({ id: members.id }).from(members)
      .where(and(eq(members.role, 'admin'), eq(members.active, true), ne(members.id, id))).get()) {
      throw new HTTPException(400, { message: '必须保留至少一个启用的管理员' });
    }
  }
  app.patch('/members/:id', requireAdmin, async c => {
    const fields = memberPatch.parse(await c.req.json());
    const id = c.req.param('id');
    const member = transaction(db, db => {
      if (fields.active && getById(db, 'members', id).pendingInvitation) {
        throw new HTTPException(409, { message: '此账号尚未通过邀请开通' });
      }
      if (fields.active === false || fields.role === 'member') protectLastAdmin(db, id);
      return update(db, 'members', id, fields);
    });
    return c.json(member);
  });
  app.post('/members/:id/reset-password', requireAdmin, async c => {
    const { newPassword } = memberPasswordBody.parse(await c.req.json());
    const id = c.req.param('id');
    if (getById(db, 'members', id).pendingInvitation) {
      throw new HTTPException(409, { message: '请通过邀请开通此账号' });
    }
    update(db, 'members', id, { passwordHash: await bcrypt.hash(newPassword, 10) });
    return c.json({ ok: true });
  });
  app.delete('/members/:id', requireAdmin, c => {
    const id = c.req.param('id');
    if (id === c.get('user').id) throw new HTTPException(400, { message: '不能删除自己的账号' });
    transaction(db, db => { protectLastAdmin(db, id); remove(db, 'members', id); });
    return c.json({ ok: true });
  });

  app.get('/projects', c => c.json(listProjects(db)));
  app.post('/projects', requireAdmin, async c => {
    const fields = projectCreate.parse(await c.req.json());
    return c.json(insert(db, 'projects', { ...fields, archived: false }), 201);
  });
  app.patch('/projects/:id', requireAdmin, async c => {
    const fields = projectPatch.parse(await c.req.json());
    return c.json(update(db, 'projects', c.req.param('id'), fields));
  });
  app.delete('/projects/:id', requireAdmin, c => {
    const id = c.req.param('id');
    transaction(db, db => {
      if (db.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, id)).get()) {
        throw new HTTPException(400, { message: '项目有关联任务，请先归档项目或转移任务' });
      }
      remove(db, 'projects', id);
    });
    return c.json({ ok: true });
  });
  return app;
}
