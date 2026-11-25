import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Copy, FolderGit2, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import type { PeriodSummaryResponse } from '@calendar/shared';
import { formatHours } from '@calendar/shared';
import { summaryApi } from '../../api';
import type { PeriodType } from '../../store/uiStore';
import {
  canNavigatePrev,
  clampDateMin,
  dayjs,
  getMonthDateRange,
  getWeekDateRange,
  SHORT_WEEKDAY_NAMES_ZH,
} from '../../utils/date';
import { PeriodPicker } from '../canvas/PeriodPicker';
import { generatePeriodMarkdownReport } from '../../utils/markdown';
import { ModalDialog, Tabs } from '../ui/overlays';
import { QueryError } from '../ui/QueryError';
import { Badge, Button, cn, Spinner } from '../ui/primitives';

interface Props {
  open: boolean;
  initialPeriod: PeriodType;
  initialDate: string;
  onClose: () => void;
}

export const ReviewModal: React.FC<Props> = ({ open, initialPeriod, initialDate, onClose }) => {
  const [period, setPeriod] = useState<PeriodType>(initialPeriod);
  const [date, setDate] = useState<string>(clampDateMin(initialDate));

  useEffect(() => {
    if (open) {
      setPeriod(initialPeriod);
      setDate(clampDateMin(initialDate));
    }
  }, [open, initialPeriod, initialDate]);

  const rawRange = period === 'week' ? getWeekDateRange(date) : getMonthDateRange(date);
  const startDate = clampDateMin(rawRange.startDate);
  const endDate = clampDateMin(rawRange.endDate);

  const { data: summary, isLoading, isError, refetch } = useQuery<PeriodSummaryResponse>({
    queryKey: ['summary', startDate, endDate],
    queryFn: ({ signal }) => summaryApi.getSummary({ startDate, endDate }, signal),
    enabled: open,
  });

  const handlePrev = () => {
    if (!canNavigatePrev(date, period)) return;
    const d = dayjs(date);
    setDate(
      clampDateMin((period === 'week' ? d.subtract(1, 'week') : d.subtract(1, 'month')).format('YYYY-MM-DD')),
    );
  };

  const handleNext = () => {
    const d = dayjs(date);
    setDate((period === 'week' ? d.add(1, 'week') : d.add(1, 'month')).format('YYYY-MM-DD'));
  };

  const handleCopyMarkdown = async () => {
    if (!summary) return;
    const md = generatePeriodMarkdownReport(summary);
    try {
      await navigator.clipboard.writeText(md);
      toast.success('已复制 Markdown 复盘报告');
    } catch {
      toast.error('复制失败，请检查浏览器剪贴板权限');
    }
  };

  const avgSaturation =
    summary && summary.totalExpectedMinutes > 0
      ? Math.round((summary.totalScheduledMinutes / summary.totalExpectedMinutes) * 100)
      : 100;

  return (
    <ModalDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="周 / 月复盘汇总"
      maxWidthClass="max-w-4xl"
      headerExtra={
        <Button size="xs" variant="primary" disabled={!summary} onClick={handleCopyMarkdown}>
          <Copy className="h-3.5 w-3.5" />
          复制 Markdown
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Period Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-zinc-200/70 dark:bg-zinc-800 p-0.5 text-xs">
              {(['week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'rounded-md px-2.5 py-1 font-medium cursor-pointer',
                    period === p
                      ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-50'
                      : 'text-zinc-600 dark:text-zinc-400',
                  )}
                >
                  {p === 'week' ? '周报' : '月报'}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                disabled={!canNavigatePrev(date, period)}
                onClick={handlePrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <PeriodPicker period={period} currentDate={date} onChangeDate={setDate} />
              <Button size="icon" variant="ghost" onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {startDate} ~ {endDate}
          </span>
        </div>

        {isError && <QueryError message={summary ? '复盘刷新失败，当前显示上次结果' : '无法加载复盘数据'} retry={() => void refetch()} />}
        {isLoading && (
          <div className="py-16">
            <Spinner label="正在汇总统计数据..." />
          </div>
        )}
        {summary && (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">应出勤工时</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatHours(summary.totalExpectedMinutes)}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">已排工时</div>
                <div className="mt-1 text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {formatHours(summary.totalScheduledMinutes)}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">空闲工时</div>
                <div
                  className={cn(
                    'mt-1 text-lg font-semibold',
                    summary.totalGapMinutes > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  {formatHours(summary.totalGapMinutes)}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5">
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">平均饱和度</div>
                <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {avgSaturation}%
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs.Root defaultValue="members">
              <Tabs.List className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 text-xs mb-3">
                <Tabs.Trigger
                  value="members"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-zinc-600 dark:text-zinc-400 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs cursor-pointer"
                >
                  <Users2 className="h-3.5 w-3.5" />
                  按成员 ({summary.members.length})
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="projects"
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-zinc-600 dark:text-zinc-400 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs cursor-pointer"
                >
                  <FolderGit2 className="h-3.5 w-3.5" />
                  按项目 ({summary.projects.length})
                </Tabs.Trigger>
              </Tabs.List>

              <Tabs.Content value="members" className="space-y-3">
                {summary.members.map((m) => (
                  <div
                    key={m.member.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: m.member.avatarColor }}
                        />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {m.member.name}
                        </span>
                        {m.member.title && (
                          <span className="text-xs text-zinc-400">{m.member.title}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge tone="blue">已排 {formatHours(m.scheduledMinutes)}</Badge>
                        {m.gapMinutes > 0 ? (
                          <Badge tone={m.emptyDays > 0 ? 'red' : 'amber'}>
                            空档 {formatHours(m.gapMinutes)}
                          </Badge>
                        ) : (
                          <Badge tone="green">已排满</Badge>
                        )}
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          {Math.round(m.saturation * 100)}%
                        </span>
                      </div>
                    </div>

                    {m.gapDetails && m.gapDetails.length > 0 && (
                      <div className="rounded-lg border border-rose-200/70 dark:border-rose-500/20 bg-rose-50/40 dark:bg-rose-500/5 p-2.5 space-y-1.5">
                        <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                          空闲时段明细（共 {formatHours(m.gapMinutes)}）
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.gapDetails.map((g, idx) => {
                            const wd = SHORT_WEEKDAY_NAMES_ZH[dayjs(g.date).isoWeekday() - 1];
                            return (
                              <span
                                key={`${g.date}-${g.startTime}-${idx}`}
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
                                  g.isFullDay
                                    ? 'bg-rose-100/80 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                                    : 'bg-amber-100/80 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
                                )}
                              >
                                <span>
                                  {g.date} (周{wd})
                                </span>
                                <span>
                                  {g.isFullDay ? '全天' : `${g.slotLabel} ${g.startTime}-${g.endTime}`}
                                </span>
                                <span className="font-semibold">· {formatHours(g.minutes)}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {m.tasks.length > 0 ? (
                      <div className="space-y-1 pt-1">
                        {m.tasks.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1.5 text-xs"
                          >
                            <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                              {t.title}
                            </span>
                            <span className="shrink-0 text-[11px] text-zinc-500 dark:text-zinc-400">
                              {t.startDate} ~ {t.endDate}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-400">本周期暂无排期任务</div>
                    )}
                  </div>
                ))}
              </Tabs.Content>

              <Tabs.Content value="projects" className="space-y-3">
                {summary.projects.map((p) => (
                  <div
                    key={p.project.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: p.project.color }}
                        />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {p.project.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge tone="blue">总投入 {formatHours(p.totalMinutes)}</Badge>
                        <Badge tone="neutral">{p.taskCount} 项任务</Badge>
                      </div>
                    </div>
                    {p.byMember.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {p.byMember.map((bm) => (
                          <span
                            key={bm.memberId}
                            className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-700 dark:text-zinc-300"
                          >
                            {bm.memberName} · {formatHours(bm.minutes)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </Tabs.Content>
            </Tabs.Root>
          </>
        )}
      </div>
    </ModalDialog>
  );
};
