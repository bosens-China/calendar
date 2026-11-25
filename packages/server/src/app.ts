import type { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { accountRoutes, loginRoute } from './accounts.js';
import { requireAuth, type Env } from './auth.js';
import { scheduleRoutes } from './schedule.js';
import { settingsRoutes } from './settings.js';

export function createApp(db: DatabaseSync) {
  const app = new Hono<Env>();
  app.use('/api/*', cors());
  app.get('/api/health', c => c.json({ ok: true }));
  app.route('/api', loginRoute(db));
  app.use('/api/*', requireAuth(db));
  app.route('/api', accountRoutes(db));
  app.route('/api', scheduleRoutes(db));
  app.route('/api', settingsRoutes(db));
  app.notFound(c => c.json({ error: '接口不存在' }, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return c.json({ error: [issue.path.join('.'), issue.message].filter(Boolean).join(' ') }, 400);
    }
    if (error instanceof SyntaxError) return c.json({ error: '请求体必须为合法 JSON' }, 400);
    if ('errcode' in error) {
      if (error.errcode === 2067) return c.json({ error: '用户名已存在' }, 409);
      if (error.errcode === 787) return c.json({ error: '关联的成员或项目无效' }, 400);
    }
    console.error(error);
    return c.json({ error: '服务内部错误' }, 500);
  });
  return app;
}
