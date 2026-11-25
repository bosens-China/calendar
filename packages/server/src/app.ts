import type { CalendarDb } from './db.js';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { CalendarInputError } from '@calendar/shared';
import { accountRoutes, loginRoute } from './accounts.js';
import { requireAuth, type Env } from './auth.js';
import { managedInvitationRoutes, publicInvitationRoutes } from './invitations.js';
import { addOpenApi } from './openapi.js';
import { scheduleRoutes } from './schedule.js';
import { settingsRoutes } from './settings.js';

function errorResponse(c: Context<Env>, message: string, status: ContentfulStatusCode) {
  if (/^\/api\/settings\/holidays\/[^/]+$/.test(c.req.path) && ['PUT', 'DELETE'].includes(c.req.method)) {
    const code = status === 400 ? 'INVALID_INPUT'
      : status === 401 ? 'UNAUTHENTICATED'
      : status === 403 ? 'FORBIDDEN' : 'REQUEST_FAILED';
    return c.json({ data: null, message, code }, status);
  }
  return c.json({ error: message }, status);
}

export function createApp(db: CalendarDb) {
  const app = new Hono<Env>();
  app.use('/api/*', cors());
  app.get('/api/health', c => c.json({ ok: true }));
  app.route('/api', loginRoute(db));
  app.route('/api', publicInvitationRoutes(db));
  const docs = new Hono<Env>();
  addOpenApi(app, docs);
  app.route('/', docs);
  app.use('/api/*', requireAuth(db));
  app.route('/api', accountRoutes(db));
  app.route('/api', managedInvitationRoutes(db));
  app.route('/api', scheduleRoutes(db));
  app.route('/api', settingsRoutes(db));
  app.notFound(c => c.json({ error: '接口不存在' }, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return errorResponse(c, error.message, error.status);
    if (error instanceof CalendarInputError) return errorResponse(c, error.message, 400);
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return errorResponse(c, [issue.path.join('.'), issue.message].filter(Boolean).join(' '), 400);
    }
    if (error instanceof SyntaxError) return errorResponse(c, '请求体必须为合法 JSON', 400);
    const databaseError = error.cause instanceof Error ? error.cause : error;
    if ('errcode' in databaseError) {
      if (databaseError.errcode === 2067) return c.json({ error: '登录账号已存在' }, 409);
      if (databaseError.errcode === 787) return c.json({ error: '关联的成员或项目无效' }, 400);
    }
    console.error(JSON.stringify({
      time: new Date().toISOString(), level: 'error', service: 'calendar', message: error.message,
      method: c.req.method, path: c.req.path, stack: error.stack,
    }));
    return errorResponse(c, '服务内部错误', 500);
  });
  return app;
}
