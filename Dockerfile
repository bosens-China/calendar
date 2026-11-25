# syntax=docker/dockerfile:1
FROM --platform=$BUILDPLATFORM node:24-alpine AS workspace
WORKDIR /app
RUN corepack enable && corepack install --global pnpm@11.17.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/app/package.json packages/app/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json

FROM workspace AS build
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY packages/ packages/
RUN pnpm build

# Runtime dependencies are JavaScript. Node supplies SQLite for the target platform.
FROM workspace AS production-dependencies
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm --filter @calendar/server... install --prod --frozen-lockfile

FROM node:24-alpine AS production
ENV NODE_ENV=production PORT=3001 DB_PATH=/data/calendar.db
WORKDIR /app
RUN mkdir /data && chown node:node /data
COPY --from=production-dependencies /app /app
COPY --from=build /app/packages/app/dist ./packages/app/dist
COPY --from=build /app/packages/server/dist ./packages/server/dist
COPY --from=build /app/packages/server/drizzle ./packages/server/drizzle
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
USER node
EXPOSE 3001
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "packages/server/dist/index.js"]
