import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { transaction } from './db.js';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCurrentMonday(): Date {
  const now = new Date();
  const base = now.getFullYear() < 2026 ? new Date(2026, 10, 25) : now;
  const day = base.getDay(); // 0 = Sun, 1 = Mon ...
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff);
  if (mon.getFullYear() < 2026) return new Date(2026, 0, 5);
  return mon;
}

function addDays(base: Date, offset: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return formatDate(d);
}

/**
 * 首次启动真实数据库时注入开箱即用的演示数据（仅当成员数 <= 1 且无任务时执行）
 * 覆盖：4 名不重复色成员、3 个项目、本周满排/跨天/缺半天(黄)/全天空档(红)/请假(灰)
 */
export function seedDemoDataIfEmpty(db: DatabaseSync) {
  if (process.env.DISABLE_DEMO_SEED === '1') return;

  const alreadySeeded = db.prepare("SELECT key FROM settings WHERE key = 'demoSeeded'").get();
  if (alreadySeeded) return;

  const memberCount = (db.prepare('SELECT COUNT(*) AS cnt FROM members').get() as { cnt: number }).cnt;
  const taskCount = (db.prepare('SELECT COUNT(*) AS cnt FROM tasks').get() as { cnt: number }).cnt;
  const leaveCount = (db.prepare('SELECT COUNT(*) AS cnt FROM leaves').get() as { cnt: number }).cnt;
  const projectCount = (db.prepare('SELECT COUNT(*) AS cnt FROM projects').get() as { cnt: number }).cnt;
  if (memberCount > 1 || taskCount > 0 || leaveCount > 0 || projectCount > 2) return;

  const admin = db.prepare("SELECT id FROM members WHERE role = 'admin' LIMIT 1").get() as
    | { id: string }
    | undefined;
  if (!admin) return;

  const existingProjects = db.prepare('SELECT id, name FROM projects ORDER BY createdAt, rowid').all() as Array<{
    id: string;
    name: string;
  }>;

  const now = new Date().toISOString();
  const demoPassHash = bcrypt.hashSync('123456', 10);
  const mon = getCurrentMonday();

  transaction(db, () => {
    // 1. Projects (ensure 3 projects)
    const p1Id = existingProjects[0]?.id ?? randomUUID();
    const p2Id = existingProjects[1]?.id ?? randomUUID();
    const p3Id = randomUUID();

    if (!existingProjects[0]) {
      db.prepare(
        'INSERT INTO projects(id, name, color, description, archived, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?)',
      ).run(p1Id, '核心研发', '#2563eb', '核心产品架构与迭代开发', now, now);
    }
    if (!existingProjects[1]) {
      db.prepare(
        'INSERT INTO projects(id, name, color, description, archived, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?)',
      ).run(p2Id, '运维支持', '#0891b2', '稳定性保障、监控与线上应急', now, now);
    }
    db.prepare(
      'INSERT INTO projects(id, name, color, description, archived, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?)',
    ).run(p3Id, '体验升级', '#7c3aed', 'Canvas 交互重构与设计系统打磨', now, now);

    // 2. Demo Members (unique non-overlapping colors)
    const mLin = randomUUID();
    const mChen = randomUUID();
    const mSu = randomUUID();

    const insertMember = db.prepare(
      `INSERT INTO members(id, username, email, passwordHash, name, role, title, avatarColor, active, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'member', ?, ?, 1, ?, ?)`,
    );
    insertMember.run(mLin, 'linqing', 'linqing@calendar.local', demoPassHash, '林清', '前端架构', '#059669', now, now);
    insertMember.run(mChen, 'chenmo', 'chenmo@calendar.local', demoPassHash, '陈默', '后端研发', '#7c3aed', now, now);
    insertMember.run(mSu, 'suwan', 'suwan@calendar.local', demoPassHash, '苏晚', '产品设计', '#db2777', now, now);

    // 3. Demo Tasks across current week (Mon=0 ... Fri=4)
    const insertTask = db.prepare(
      `INSERT INTO tasks(id, title, description, projectId, assigneeId, startDate, startTime, endDate, endTime, status, priority, adjustedByMember, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    // 管理员：周一~周三满排，周四仅上午（演示黄色缺下午），周五满排
    insertTask.run(
      randomUUID(), 'Q4 排期评审与里程碑拆解', '对齐各项目交付节奏与人力分配',
      p1Id, admin.id, addDays(mon, 0), '09:00', addDays(mon, 1), '18:00', 'done', 'high', 0, admin.id, now, now,
    );
    insertTask.run(
      randomUUID(), '核心架构代码走查', '评审鉴权隔离与节假日缓存逻辑',
      p1Id, admin.id, addDays(mon, 2), '09:00', addDays(mon, 2), '18:00', 'in_progress', 'medium', 0, admin.id, now, now,
    );
    insertTask.run(
      randomUUID(), '客户反馈与需求复盘', '整理本周重点改进清单',
      p3Id, admin.id, addDays(mon, 3), '09:00', addDays(mon, 3), '12:00', 'todo', 'medium', 0, admin.id, now, now,
    );
    insertTask.run(
      randomUUID(), '版本发布与上线值守', '生产环境回归验证',
      p2Id, admin.id, addDays(mon, 4), '09:00', addDays(mon, 4), '18:00', 'todo', 'high', 0, admin.id, now, now,
    );

    // 林清：周一~周二满排，周三请假全天，周四~周五满排
    insertTask.run(
      randomUUID(), 'Canvas 画布与触控板平移', '实现 XY 自由滚动与拖拽排期交互',
      p3Id, mLin, addDays(mon, 0), '09:00', addDays(mon, 1), '18:00', 'done', 'high', 0, admin.id, now, now,
    );
    insertTask.run(
      randomUUID(), 'shadcn/ui 组件库替换与主题调优', '移除重组件库，优化首屏体积',
      p3Id, mLin, addDays(mon, 3), '09:00', addDays(mon, 4), '18:00', 'in_progress', 'high', 1, admin.id, now, now,
    );

    // 陈默：周一~周二满排，周三全天空档（演示红色全天空档），周四~周五满排
    insertTask.run(
      randomUUID(), 'Hono 接口与 SQLite 事务优化', '补全权限隔离与并发保护',
      p1Id, mChen, addDays(mon, 0), '09:00', addDays(mon, 1), '18:00', 'done', 'high', 0, admin.id, now, now,
    );
    insertTask.run(
      randomUUID(), 'GitHub 节假日同步与跨年缓存', '接入 holiday-cn 自动按年同步',
      p2Id, mChen, addDays(mon, 3), '09:00', addDays(mon, 4), '18:00', 'in_progress', 'medium', 0, admin.id, now, now,
    );

    // 苏晚：周一上午有活下午空（黄色），周二~周四满排，周五上午请假+下午任务
    insertTask.run(
      randomUUID(), '极简工作台交互稿定稿', '输出 Canvas 视觉规范与图标',
      p3Id, mSu, addDays(mon, 0), '09:00', addDays(mon, 0), '12:00', 'done', 'medium', 0, admin.id, now, now,
    );
    insertTask.run(
      randomUUID(), '复盘弹窗与空档提示走查', '核对红/黄/灰视觉语义',
      p3Id, mSu, addDays(mon, 1), '09:00', addDays(mon, 3), '18:00', 'in_progress', 'high', 0, admin.id, now, now,
    );
    insertTask.run(
      randomUUID(), '下周迭代原型评审', '收集组员试用意见',
      p1Id, mSu, addDays(mon, 4), '13:30', addDays(mon, 4), '18:00', 'todo', 'low', 0, admin.id, now, now,
    );

    // 4. Demo Leaves
    const insertLeave = db.prepare(
      `INSERT INTO leaves(id, memberId, startDate, startTime, endDate, endTime, type, reason, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertLeave.run(
      randomUUID(), mLin, addDays(mon, 2), '09:00', addDays(mon, 2), '18:00', 'annual', '个人年假', mLin, now, now,
    );
    insertLeave.run(
      randomUUID(), mSu, addDays(mon, 4), '09:00', addDays(mon, 4), '12:00', 'personal', '上午办事调休', mSu, now, now,
    );

    db.prepare("INSERT INTO settings(key, value) VALUES ('demoSeeded', '1') ON CONFLICT(key) DO NOTHING").run();
  });
}
