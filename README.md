# Calendar · 团队排期画布

面向团队管理者与成员的极简 **XY 排期画布与任务管理工具**。在一个全屏画布中直观掌握每位成员的周/月排期、空档缺口与多项目投入，支持自定义工作时段、自动同步中国法定节假日、请假登记与周/月复盘导出。

## 核心特性

- **极简全屏 XY 画布**：X 轴为时间（周视图周一至周日 / 月视图 1 号至月底），Y 轴为成员；支持触控板双指自由滑动与鼠标拖拽平移画布。
- **无缝排期与空档可视化**：成员自动分配不重复专属色；工作日自动跳过午休与休假日，全天空档以浅红标示、当天未排满以浅黄标示、请假以浅灰区分，管理员支持拖拽任务重排。
- **多项目扁平管理**：默认扁平展示全部项目，支持按项目多选筛选；项目管理、人员管理、复盘与设置全部原地弹层完成，零页面跳转。
- **GitHub 节假日自动同步**：对接 `NateScarlet/holiday-cn` 按年自动拉取并持久化缓存（支持 2026 年及以后），跨年自动更新且完整留存历史年份记录。
- **权限隔离与轻量协同**：支持账号密码登录与账号+邮箱找回密码；管理员统筹全局，普通成员仅查看和微调自己的任务并自助登记请假。
- **周/月复盘报告**：自动统计应出勤、已排工时、饱和度及具体空闲日期/时段明细，支持一键复制 Markdown 周报/月报。
- **护眼浅色 / 深色 / 跟随系统主题**：内置 `Auto / Light / Dark` 三态主题切换，浅色模式采用低眩光护眼暖灰画布。

## 技术栈

- **前端**：Vite 6 + React 19 + React Compiler (`babel-plugin-react-compiler`) + TypeScript + Tailwind CSS v4 + Radix UI + TanStack Query + Zustand + ahooks + Day.js
- **后端**：Hono + `@hono/node-server` + Node 24 原生 `node:sqlite` + Zod + jose (JWT) + bcryptjs
- **工程化**：pnpm Monorepo（`@calendar/shared` / `@calendar/server` / `@calendar/app`）+ ESLint（含 `eslint-plugin-react-compiler`）

## 快速开始

环境要求：Node.js `>= 22.13`（推荐 `24.x`）、`pnpm >= 10`

```bash
# 1. 安装依赖
pnpm install

# 2. 构建共享包
pnpm --filter @calendar/shared build

# 3. 同时启动前后端开发服务
pnpm dev
```

启动后访问 `http://localhost:5173`（后端 API 监听 `http://localhost:3001`）。

- 首次启动会自动初始化本地 SQLite 数据库并注入默认演示数据（4 名成员、3 个项目、本周排期与请假示例）。
- 默认管理员账号：`admin` / `admin123`（绑定邮箱 `admin@calendar.local`）。
- 演示成员账号：`linqing` / `chenmo` / `suwan`（密码均为 `123456`）。

## 常用脚本

```bash
pnpm dev        # 并行启动前端与后端
pnpm build      # 全量构建 shared / server / app
pnpm typecheck  # 全量 TypeScript 类型检查
pnpm lint       # ESLint + React Compiler 静态规则检查
pnpm test       # 运行排期引擎单测与后端集成测试
```

## 目录结构

```text
├── docs/PRD.md          # 产品需求文档
├── packages/
│   ├── shared/          # 共享类型、排期/空档计算引擎、内置节假日兜底
│   ├── server/          # Hono REST API 与 SQLite 持久化
│   └── app/             # Vite + React 19 全屏排期画布前端
└── package.json
```

## License

[MIT](./License)
