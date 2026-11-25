import { formatHours, type PeriodSummaryResponse } from '@calendar/shared';
import { TASK_STATUS_CONFIG } from './scheduleHelper';

export function generatePeriodMarkdownReport(summary: PeriodSummaryResponse): string {
  const {
    startDate,
    endDate,
    totalExpectedMinutes,
    totalScheduledMinutes,
    totalGapMinutes,
    membersWithGap,
    members,
    projects,
  } = summary;

  const totalSaturation =
    totalExpectedMinutes > 0
      ? `${Math.round((totalScheduledMinutes / totalExpectedMinutes) * 100)}%`
      : '100%';

  const lines: string[] = [];

  lines.push(`# 团队排期与工时复盘报告`);
  lines.push(``);
  lines.push(`> 统计周期：**${startDate}** 至 **${endDate}**`);
  lines.push(``);

  lines.push(`## 📊 团队总览 KPI`);
  lines.push(``);
  lines.push(`| 指标 | 数值 | 说明 |`);
  lines.push(`| :--- | :--- | :--- |`);
  lines.push(`| 总应出勤工时 | **${formatHours(totalExpectedMinutes)}** | 扣除节假日与请假后 |`);
  lines.push(`| 总已排任务工时 | **${formatHours(totalScheduledMinutes)}** | 实际有效工作工时 |`);
  lines.push(`| 总空余/空档工时 | **${formatHours(totalGapMinutes)}** | 未满或空档工时 |`);
  lines.push(`| 团队综合饱和度 | **${totalSaturation}** | 已排工时 / 应出勤工时 |`);
  lines.push(`| 存在空档成员数 | **${membersWithGap} / ${members.length}** 人 | 需关注或调优排期 |`);
  lines.push(``);

  lines.push(`## 👥 成员工时与饱和度明细`);
  lines.push(``);
  lines.push(`| 成员 | 职位 | 应出勤 | 已排工时 | 空档工时 | 请假 | 饱和度 | 任务数 |`);
  lines.push(`| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`);

  for (const m of members) {
    const sat = `${Math.round(m.saturation * 100)}%`;
    lines.push(
      `| ${m.member.name} | ${m.member.title || '-'} | ${formatHours(m.expectedMinutes)} | ${formatHours(
        m.scheduledMinutes,
      )} | ${formatHours(m.gapMinutes)} | ${formatHours(m.leaveMinutes)} | ${sat} | ${m.taskCount} |`,
    );
  }
  lines.push(``);

  lines.push(`### 成员具体工作内容`);
  lines.push(``);
  for (const m of members) {
    lines.push(`#### ${m.member.name}（${m.member.title || '组员'}）`);
    if (m.tasks.length === 0) {
      lines.push(`- *(暂无已分配任务)*`);
    } else {
      for (const t of m.tasks) {
        const statusLabel = TASK_STATUS_CONFIG[t.status]?.label || t.status;
        const adjustedText = t.adjustedByMember ? ' `已微调`' : '';
        lines.push(
          `- [${statusLabel}] **${t.title}** (${t.startDate} ${t.startTime} ~ ${t.endDate} ${t.endTime})${adjustedText}${
            t.description ? ` - ${t.description}` : ''
          }`,
        );
      }
    }
    if (m.gapDetails && m.gapDetails.length > 0) {
      lines.push(
        `  - 空闲时段（共 ${formatHours(m.gapMinutes)}）：${m.gapDetails
          .map((g) => `${g.date} ${g.isFullDay ? '全天' : `${g.slotLabel}(${g.startTime}-${g.endTime})`} ${formatHours(g.minutes)}`)
          .join('；')}`,
      );
    }
    if (m.byProject.length > 0) {
      lines.push(
        `  - 项目分布：${m.byProject
          .map((p: { projectName: string; minutes: number }) => `${p.projectName}: ${formatHours(p.minutes)}`)
          .join(', ')}`,
      );
    }
    lines.push(``);
  }

  lines.push(`## 📁 项目维度汇总`);
  lines.push(``);
  lines.push(`| 项目名称 | 投入总工时 | 关联任务数 | 参与成员数 | 任务状态分布 |`);
  lines.push(`| :--- | :--- | :--- | :--- | :--- |`);

  for (const p of projects) {
    const statusDist = `已完成: ${p.statusCounts.done}, 进行中: ${p.statusCounts.in_progress}, 待开始: ${p.statusCounts.todo}, 延期: ${p.statusCounts.delayed}`;
    lines.push(
      `| **${p.project.name}** | ${formatHours(p.totalMinutes)} | ${p.taskCount} | ${p.memberCount} 人 | ${statusDist} |`,
    );
  }
  lines.push(``);

  return lines.join('\n');
}
