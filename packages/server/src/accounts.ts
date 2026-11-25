import type { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { issueToken, requireAdmin, scopedMember, type Env } from './auth.js';
import { transaction } from './db.js';
import { getById, insert, listMembers, listProjects, remove, update } from './store.js';
import { forgotPasswordSchema, memberCreate, memberPatch, password, projectCreate, projectPatch, text } from './validation.js';

const MEMBER_COLOR_PALETTE = [
  '#2563eb', '#0891b2', '#059669', '#7c3aed', '#db2777',
  '#4f46e5', '#0d9488', '#65a30d', '#9333ea', '#0284c7',
  '#e11d48', '#ea580c', '#0f766e', '#6366f1', '#16a34a',
  '#8b5cf6', '#06b6d4', '#1d4ed8', '#be185d', '#047857',
];

function pickUniqueMemberColor(db: DatabaseSync): string {
  const rows = db.prepare('SELECT avatarColor FROM members').all() as Array<{ avatarColor: string }>;
  const used = new Set(rows.map(r => String(r.avatarColor).toLowerCase()));
  const available = MEMBER_COLOR_PALETTE.filter(c => !used.has(c.toLowerCase()));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  for (let i = 0; i < 32; i++) {
    const hue = Math.floor(Math.random() * 360);
    const hex = hslToHex(hue, 68, 45);
    if (!used.has(hex.toLowerCase())) return hex;
  }
  return '#2563eb';
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function loginRoute(db: DatabaseSync) {
  const app = new Hono<Env>();
  app.post('/auth/login', async c => {
    const input = z.object({ username: text, password }).strict().parse(await c.req.json());
    const row = db.prepare('SELECT id, passwordHash FROM members WHERE username = ? AND active = 1').get(input.username) as
      { id: string; passwordHash: string } | undefined;
    if (!row || !await bcrypt.compare(input.password, String(row.passwordHash))) {
      throw new HTTPException(401, { message: '用户名或密码错误' });
    }
    const user = getById(db, 'members', String(row.id));
    return c.json({ token: await issueToken(db, user.id, String(row.passwordHash)), user });
  });
  app.post('/auth/forgot-password', async c => {
    const input = forgotPasswordSchema.parse(await c.req.json());
    const row = db
      .prepare('SELECT id, email, role FROM members WHERE username = ? AND active = 1')
      .get(input.username) as { id: string; email: string; role: string } | undefined;
    if (
      !row ||
      row.role === 'admin' ||
      !row.email ||
      row.email.trim().toLowerCase() !== input.email.toLowerCase()
    ) {
      throw new HTTPException(400, { message: '账号或绑定邮箱不匹配，请核对后重试或联系管理员' });
    }
    const passwordHash = await bcrypt.hash(input.newPassword, 10);
    db.prepare('UPDATE members SET passwordHash = ?, updatedAt = ? WHERE id = ?')
      .run(passwordHash, new Date().toISOString(), String(row.id));
    return c.json({ ok: true });
  });
  return app;
}

export function accountRoutes(db: DatabaseSync) {
  const app = new Hono<Env>();
  app.get('/auth/me', c => c.json({ user: c.get('user') }));
  app.post('/auth/change-password', async c => {
    const { oldPassword, newPassword } = z.object({ oldPassword: password, newPassword: password }).strict().parse(await c.req.json());
    const id = c.get('user').id;
    const row = db.prepare('SELECT passwordHash FROM members WHERE id = ?').get(id) as { passwordHash: string } | undefined;
    const oldHash = row?.passwordHash;
    if (!oldHash || !await bcrypt.compare(oldPassword, String(oldHash))) throw new HTTPException(400, { message: '原密码错误' });
    const hash = await bcrypt.hash(newPassword, 10);
    const result = db.prepare('UPDATE members SET passwordHash = ?, updatedAt = ? WHERE id = ? AND passwordHash = ?')
      .run(hash, new Date().toISOString(), id, oldHash);
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

  function protectLastAdmin(id: string) {
    const member = getById(db, 'members', id);
    if (member.active && member.role === 'admin' && !db.prepare("SELECT id FROM members WHERE role = 'admin' AND active = 1 AND id <> ? LIMIT 1").get(id)) {
      throw new HTTPException(400, { message: '必须保留至少一个启用的管理员' });
    }
  }
  app.patch('/members/:id', requireAdmin, async c => {
    const fields = memberPatch.parse(await c.req.json());
    const id = c.req.param('id');
    const member = transaction(db, () => {
      if (fields.active === false || fields.role === 'member') protectLastAdmin(id);
      return update(db, 'members', id, fields);
    });
    return c.json(member);
  });
  app.post('/members/:id/reset-password', requireAdmin, async c => {
    const { newPassword } = z.object({ newPassword: password }).strict().parse(await c.req.json());
    update(db, 'members', c.req.param('id'), { passwordHash: await bcrypt.hash(newPassword, 10) });
    return c.json({ ok: true });
  });
  app.delete('/members/:id', requireAdmin, c => {
    const id = c.req.param('id');
    if (id === c.get('user').id) throw new HTTPException(400, { message: '不能删除自己的账号' });
    transaction(db, () => { protectLastAdmin(id); remove(db, 'members', id); });
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
    transaction(db, () => {
      if (db.prepare('SELECT id FROM tasks WHERE projectId = ? LIMIT 1').get(id)) {
        throw new HTTPException(400, { message: '项目有关联任务，请先归档项目或转移任务' });
      }
      remove(db, 'projects', id);
    });
    return c.json({ ok: true });
  });
  return app;
}
