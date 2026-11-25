import { pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createDb } from './db.js';
import { seedDemoDataIfEmpty } from './seed-demo.js';

export { createApp } from './app.js';

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDb();
  seedDemoDataIfEmpty(db);
  const app = createApp(db);
  const server = serve({ fetch: app.fetch, port: Number(process.env.PORT || 3001) }, info => {
    console.log(`Calendar API listening on port ${info.port}`);
  });
  function stop() {
    server.close(() => db.close());
  }
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
