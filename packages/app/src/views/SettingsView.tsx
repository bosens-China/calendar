import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Plus, RefreshCw, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { HolidayOverride, WorkSlot } from '@calendar/shared';
import { formatHours } from '@calendar/shared';
import { settingsApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { MIN_ALLOWED_YEAR } from '../utils/date';
import { calculateSlotMinutes } from '../utils/scheduleHelper';
import { Tabs } from '../components/ui/overlays';
import { Badge, Button, FieldLabel, Input, SelectField, Spinner } from '../components/ui/primitives';

export const SettingsView: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Work Slots
  const [localSlots, setLocalSlots] = useState<WorkSlot[]>([]);
  const [dirtySlots, setDirtySlots] = useState(false);

  const { data: serverSlots = [], isLoading: loadingSlots } = useQuery<WorkSlot[]>({
    queryKey: ['settings', 'workSlots'],
    queryFn: settingsApi.getWorkSlots,
  });

  useEffect(() => {
    if (serverSlots.length > 0) {
      setLocalSlots(serverSlots);
      setDirtySlots(false);
    }
  }, [serverSlots]);

  const saveSlotsMutation = useMutation({
    mutationFn: (slots: WorkSlot[]) => settingsApi.updateWorkSlots(slots),
    onSuccess: () => {
      toast.success('工作时段已保存');
      setDirtySlots(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'workSlots'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '保存失败'),
  });

  // Holidays
  const currentYear = Math.max(MIN_ALLOWED_YEAR, new Date().getFullYear());
  const availableYears = Array.from(
    { length: Math.max(3, currentYear - MIN_ALLOWED_YEAR + 3) },
    (_, i) => MIN_ALLOWED_YEAR + i,
  );
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [newDate, setNewDate] = useState(`${currentYear}-01-01`);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<'holiday' | 'workday'>('holiday');

  useEffect(() => {
    setNewDate(`${selectedYear}-01-01`);
  }, [selectedYear]);

  const { data: holidays = [], isLoading: loadingHolidays } = useQuery<HolidayOverride[]>({
    queryKey: ['settings', 'holidays', selectedYear],
    queryFn: () => settingsApi.getHolidays(selectedYear),
  });

  const invalidateHolidays = () => {
    queryClient.invalidateQueries({ queryKey: ['settings', 'holidays'] });
    queryClient.invalidateQueries({ queryKey: ['summary'] });
  };

  const saveHolidaysMutation = useMutation({
    mutationFn: (updated: HolidayOverride[]) => settingsApi.updateHolidays(updated, selectedYear),
    onSuccess: () => {
      invalidateHolidays();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '保存节假日失败'),
  });

  const syncHolidaysMutation = useMutation({
    mutationFn: (year: number) => settingsApi.syncHolidays(year),
    onSuccess: (res) => {
      toast.success(`已从 GitHub 同步 ${res.year} 年节假日（${res.holidays.length} 条）`);
      invalidateHolidays();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '同步失败'),
  });

  const resetHolidaysMutation = useMutation({
    mutationFn: (year: number) => settingsApi.resetHolidays(year),
    onSuccess: () => {
      toast.success(`已重置 ${selectedYear} 年内置兜底节假日`);
      invalidateHolidays();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '重置失败'),
  });

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate.startsWith(`${selectedYear}-`) || !newName.trim()) {
      toast.error(`请输入 ${selectedYear} 年内的日期与名称`);
      return;
    }
    const updated = holidays.filter((h) => h.date !== newDate);
    updated.push({ date: newDate, name: newName.trim(), kind: newKind });
    updated.sort((a, b) => a.date.localeCompare(b.date));
    await saveHolidaysMutation.mutateAsync(updated);
    setNewName('');
    toast.success('已添加节假日规则');
  };

  const handleDeleteHoliday = async (date: string) => {
    const updated = holidays.filter((h) => h.date !== date);
    await saveHolidaysMutation.mutateAsync(updated);
    toast.success('已删除该条规则');
  };

  const totalDayMinutes = localSlots.reduce((acc, s) => acc + calculateSlotMinutes(s), 0);

  return (
    <Tabs.Root defaultValue="slots" className="space-y-4">
      <Tabs.List className="inline-flex rounded-lg bg-zinc-200/70 dark:bg-zinc-900 p-1 text-xs">
        <Tabs.Trigger
          value="slots"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-zinc-600 dark:text-zinc-400 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs cursor-pointer"
        >
          <Clock className="h-3.5 w-3.5" />
          每日工作时段
        </Tabs.Trigger>
        <Tabs.Trigger
          value="holidays"
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-zinc-600 dark:text-zinc-400 data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-2xs cursor-pointer"
        >
          <Calendar className="h-3.5 w-3.5" />
          法定节假日与调休
        </Tabs.Trigger>
      </Tabs.List>

      {/* Work Slots Tab */}
      <Tabs.Content value="slots" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5">
          <div className="text-xs text-zinc-600 dark:text-zinc-400">
            标准日工时：
            <strong className="text-zinc-900 dark:text-zinc-100">
              {formatHours(totalDayMinutes)}
            </strong>
            <span className="ml-2 text-zinc-400">（午休与非工作时间自动跳过不展示）</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  setLocalSlots([
                    ...localSlots,
                    {
                      id: `slot_${Date.now()}`,
                      label: `时段${localSlots.length + 1}`,
                      startTime: '14:00',
                      endTime: '18:00',
                    },
                  ]);
                  setDirtySlots(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                添加时段
              </Button>
              <Button
                size="xs"
                variant="primary"
                disabled={!dirtySlots}
                loading={saveSlotsMutation.isPending}
                onClick={() => saveSlotsMutation.mutate(localSlots)}
              >
                <Save className="h-3.5 w-3.5" />
                保存配置
              </Button>
            </div>
          )}
        </div>

        {loadingSlots ? (
          <Spinner label="加载工作时段..." />
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            {localSlots.map((slot, idx) => (
              <div key={slot.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                <div className="col-span-4">
                  <Input
                    value={slot.label}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      const next = [...localSlots];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setLocalSlots(next);
                      setDirtySlots(true);
                    }}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="time"
                    value={slot.startTime}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      const next = [...localSlots];
                      next[idx] = { ...next[idx], startTime: e.target.value };
                      setLocalSlots(next);
                      setDirtySlots(true);
                    }}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="time"
                    value={slot.endTime}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      const next = [...localSlots];
                      next[idx] = { ...next[idx], endTime: e.target.value };
                      setLocalSlots(next);
                      setDirtySlots(true);
                    }}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  <Badge tone="blue">{formatHours(calculateSlotMinutes(slot))}</Badge>
                  {isAdmin && localSlots.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => {
                        setLocalSlots(localSlots.filter((_, i) => i !== idx));
                        setDirtySlots(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Tabs.Content>

      {/* Holidays Tab */}
      <Tabs.Content value="holidays" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">年份：</span>
            <SelectField
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-28 h-8 text-xs"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y} 年
                </option>
              ))}
            </SelectField>
            <span className="text-[11px] text-slate-400">
              来源：GitHub holiday-cn（仅 2026+，按年独立留存）
            </span>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                loading={syncHolidaysMutation.isPending}
                onClick={() => syncHolidaysMutation.mutate(selectedYear)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                从 GitHub 同步
              </Button>
              <Button
                size="xs"
                variant="outline"
                loading={resetHolidaysMutation.isPending}
                onClick={() => {
                  if (window.confirm(`确定重置 ${selectedYear} 年为内置兜底节假日吗？`)) {
                    resetHolidaysMutation.mutate(selectedYear);
                  }
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置该年
              </Button>
            </div>
          )}
        </div>

        {isAdmin && (
          <form
            onSubmit={handleAddHoliday}
            className="grid grid-cols-12 items-end gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5"
          >
            <div className="col-span-4">
              <FieldLabel>日期（{selectedYear}年）</FieldLabel>
              <Input
                type="date"
                min={`${selectedYear}-01-01`}
                max={`${selectedYear}-12-31`}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="col-span-4">
              <FieldLabel>名称</FieldLabel>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="如：国庆节 / 补班"
              />
            </div>
            <div className="col-span-2">
              <FieldLabel>性质</FieldLabel>
              <SelectField
                value={newKind}
                onChange={(e) => setNewKind(e.target.value as 'holiday' | 'workday')}
              >
                <option value="holiday">休</option>
                <option value="workday">班</option>
              </SelectField>
            </div>
            <div className="col-span-2">
              <Button type="submit" variant="primary" size="md" className="w-full">
                添加
              </Button>
            </div>
          </form>
        )}

        {loadingHolidays ? (
          <Spinner label="加载节假日..." />
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            {holidays.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-400">
                该年份暂无节假日记录，可点击「从 GitHub 同步」获取
              </div>
            ) : (
              holidays.map((h) => (
                <div key={h.date} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                      {h.date}
                    </span>
                    <span className="text-zinc-700 dark:text-zinc-300">{h.name}</span>
                    <Badge tone={h.kind === 'holiday' ? 'red' : 'blue'}>
                      {h.kind === 'holiday' ? '休 · 法定节假日' : '班 · 调休补班'}
                    </Badge>
                  </div>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => handleDeleteHoliday(h.date)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
};
