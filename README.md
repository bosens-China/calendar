# Calendar · 团队排期画布

按周或月查看团队任务、请假和空档。可以在资源时间轴和传统日历之间切换，按项目和成员筛选，并复制 Markdown 复盘。

## 选择使用方式

| 方式 | 适合谁 | 数据位置 |
| --- | --- | --- |
| GitHub Pages 个人版 | 一个人负责全团队排期，即开即用 | 当前站点和当前浏览器的 IndexedDB |
| Docker Hub 团队版 | 团队成员分别登录并管理自己的任务和请假 | 自己部署的服务及 SQLite 数据卷 |

### GitHub Pages 个人版

发布后打开 [在线工作台](https://bosens-china.github.io/calendar/) 即可使用。一人在当前浏览器管理排期名单，无需登录。换浏览器、设备或站点域名会打开另一份工作台。清除该站点的浏览器数据会清除排期。

首次打开后可以直接使用内置节假日。在系统设置中也可以手动从 GitHub 导入某一年的公开节假日数据。

### Docker Hub 团队版

团队版镜像为 `boses/calendar:latest`。将仓库里的 `compose.yaml` 和 `.env.example` 保存到部署目录。把示例复制为 `.env`，填写初始管理员密码后启动。

```bash
cp .env.example .env
# 编辑 .env，填写 ADMIN_INIT_PASSWORD
docker compose up -d
```

默认在本机的 `http://localhost:3001` 提供工作台和 API。用 `admin` 和初始密码登录。进入「人员管理 → 邀请成员」，填写登录账号、姓名和权限角色，再生成并发送邀请链接。被邀请者打开链接，只需设置密码即可加入。链接 48 小时内有效，仅能使用一次。成员可在设置中修改自己的姓名，管理员可调整角色显示名称。数据库和签名密钥位于 `calendar-data` 卷，更新镜像时保留该卷。

| 配置 | 用途 |
| --- | --- |
| `CALENDAR_IMAGE` | 镜像及标签，示例已填入 `boses/calendar:latest` |
| `ADMIN_INIT_PASSWORD` | 新建数据库时必填，至少 12 个字符且最多 72 字节 |
| `ADMIN_INIT_EMAIL` | 可选的初始管理员邮箱 |
| `CALENDAR_HOST` / `CALENDAR_PORT` | 宿主机监听地址和端口，默认 `127.0.0.1:3001` |
| `JWT_SECRET` | 可选的固定签名密钥，留空时生成并保存到数据库 |

已有数据库启动时会通过 Drizzle 迁移，保留原有账号、排期和设置。更新初始化变量只影响新数据库。团队远程访问时，可在服务前配置 HTTPS 反向代理。接口说明位于 `/api/docs`，机器可读契约位于 `/api/openapi.json`。

### 发布设置

- GitHub Pages 的发布来源设为 **GitHub Actions**。推送 `main` 并通过验证后，工作流发布 IndexedDB 版。
- 工作流使用 Docker Hub 账号 `boses` 发布，默认镜像为 `boses/calendar`。在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 添加有推送权限的密钥 `DOCKERHUB_TOKEN` 即可启用镜像发布。需要发布到其他镜像仓库时，可以设置 `DOCKERHUB_IMAGE`。
- 验证通过后，`main` 发布 `latest`，版本标签 `vX.Y.Z` 发布对应版本。镜像支持 Linux amd64 和 arm64。

## 本地开发

需要 Node.js 24 和 pnpm 11。

```bash
pnpm install --frozen-lockfile
pnpm --filter @calendar/shared build
pnpm dev:pages
```

开发团队版时，用 `ADMIN_INIT_PASSWORD='replace-with-your-own-password' pnpm dev` 启动 Vite 和 API。前端默认监听 5173，API 默认监听 3001。

```bash
pnpm build
pnpm build:pages
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

- `packages/shared` 提供排期计算、类型、输入校验和节假日数据。
- `packages/server` 提供 Hono API、团队账号、静态站点，以及基于 Drizzle 的 SQLite 存储。
- `packages/app` 提供 React 界面和两种部署的数据接入。

[产品文档](./docs/index.md) · [MIT License](./License)

维护数据库结构时，更新 `packages/server/src/schema.ts` 后运行 `pnpm --filter @calendar/server db:generate`，并提交生成的迁移。
