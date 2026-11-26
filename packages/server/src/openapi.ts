import type { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  forgotPasswordSchema, invitationAccept, invitationCreate, invitationTokenBody, profilePatch, resetBody, roleLabelsSchema, holidayFields, holidayResetBody, holidaySettings, holidaySyncBody,
  leaveCreate, leavePatch, leaveQuery, loginBody, memberCreate, memberPatch, memberPasswordBody,
  passwordChangeBody, projectCreate, projectPatch, slotSettings, summaryQuery, taskCreate,
  taskPatch, taskQuery, yearQuery,
} from '@calendar/shared';
import type { Env } from './auth.js';

const requests: Record<string, ZodTypeAny> = {
  'POST /api/auth/login': loginBody,
  'POST /api/auth/invitations/preview': invitationTokenBody,
  'POST /api/auth/invitations/accept': invitationAccept,
  'POST /api/members/invitations': invitationCreate,
  'PATCH /api/auth/me': profilePatch,
  'PUT /api/settings/role-labels': roleLabelsSchema,
  'POST /api/auth/forgot-password': forgotPasswordSchema,
  'POST /api/auth/change-password': passwordChangeBody,
  'POST /api/members': memberCreate,
  'PATCH /api/members/:id': memberPatch,
  'POST /api/members/:id/reset-password': memberPasswordBody,
  'POST /api/projects': projectCreate,
  'PATCH /api/projects/:id': projectPatch,
  'GET /api/tasks': taskQuery,
  'POST /api/tasks': taskCreate,
  'PATCH /api/tasks/:id': taskPatch,
  'GET /api/leaves': leaveQuery,
  'POST /api/leaves': leaveCreate,
  'PATCH /api/leaves/:id': leavePatch,
  'GET /api/summary': summaryQuery,
  'PUT /api/settings/work-slots': slotSettings,
  'GET /api/settings/holidays': yearQuery,
  'PUT /api/settings/holidays': holidaySettings,
  'PUT /api/settings/holidays/:date': holidayFields,
  'POST /api/settings/holidays/reset': holidayResetBody,
  'POST /api/settings/holidays/sync': holidaySyncBody,
  'POST /api/settings/reset': resetBody,
};

const publicRoutes = new Set(['/api/health', '/api/auth/login', '/api/auth/forgot-password',
  '/api/auth/invitations/preview', '/api/auth/invitations/accept']);
const createdRoutes = new Set(['/api/members', '/api/members/invitations', '/api/projects', '/api/tasks', '/api/leaves']);

type Operation = Record<string, unknown>;

function buildPaths(app: Hono<Env>) {
  const paths: Record<string, Record<string, Operation>> = {};
  for (const { method, path } of app.routes) {
    if (path === '/api/docs' || path === '/api/openapi.json') continue;
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || !path.startsWith('/api/')) continue;
    const parameterNames = Array.from(path.matchAll(/:([a-zA-Z]+)\b/g), match => match[1]);
    const apiPath = path.replace(/:([a-zA-Z]+)\b/g, '{$1}');
    const schema = requests[`${method} ${path}`];
    const jsonSchema = schema && zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' });
    const parameters: Array<{ name: string; in: string; required: boolean; schema: unknown }> = parameterNames.map(name => ({
      name, in: 'path', required: true,
      schema: name === 'date' ? { type: 'string', format: 'date' } : { type: 'string' },
    }));
    if (method === 'GET' && schema && 'shape' in schema) {
      for (const [name, field] of Object.entries(schema.shape as Record<string, ZodTypeAny>)) {
        parameters.push({
          name, in: 'query', required: !field.isOptional(),
          schema: zodToJsonSchema(field, { target: 'openApi3', $refStrategy: 'none' }),
        });
      }
    }
    const status = method === 'POST' && createdRoutes.has(path) ? '201' : '200';
    const perDay = path === '/api/settings/holidays/:date';
    const successSchema = perDay ? {
      type: 'object',
      required: ['data', 'message', 'code'],
      properties: {
        data: method === 'DELETE' ? { type: 'object', nullable: true, enum: [null] } : { type: 'object' },
        code: { type: 'string', enum: ['OK'] },
        message: { type: 'string' },
      },
    } : {};
    (paths[apiPath] ??= {})[method.toLowerCase()] = {
      tags: [path.split('/')[2]],
      ...(publicRoutes.has(path) && { security: [] }),
      ...(parameters.length > 0 && { parameters }),
      ...(jsonSchema && method !== 'GET' && {
        requestBody: {
          required: !path.endsWith('/reset') && !path.endsWith('/sync'),
          content: { 'application/json': { schema: jsonSchema } },
        },
      }),
      responses: {
        [status]: { description: '成功', content: { 'application/json': { schema: successSchema } } },
        default: { description: '请求失败', content: { 'application/json': {
          schema: { $ref: perDay ? '#/components/schemas/CalendarError' : '#/components/schemas/Error' },
        } } },
      },
    };
  }
  return paths;
}

export function addOpenApi(app: Hono<Env>, target: Hono<Env>) {
  target.get('/api/openapi.json', c => c.json({
    openapi: '3.0.3',
    info: { title: 'Calendar API', version: '2.0.0' },
    security: [{ bearerAuth: [] }],
    paths: buildPaths(app),
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Error: { type: 'object', required: ['error'], properties: { error: { type: 'string' } } },
        CalendarError: {
          type: 'object', required: ['data', 'message', 'code'],
          properties: {
            data: { type: 'object', nullable: true, enum: [null] },
            message: { type: 'string' }, code: { type: 'string' },
          },
        },
      },
    },
  }));
  target.get('/api/docs', swaggerUI({ url: '/api/openapi.json' }));
}
