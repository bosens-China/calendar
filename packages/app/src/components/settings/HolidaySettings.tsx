import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsApi } from '../../api';
import { QueryError } from '../ui/QueryError';
import { Badge, Button, FieldLabel, Input, Spinner, SelectField } from '../ui/primitives';
import { Pencil, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { getCalendarYear, type HolidayOverride } from '@calendar/shared';
import { holidayYearQuery } from '../../hooks/useHolidayRules';
import { MIN_ALLOWED_YEAR } from '../../utils/date';

export function HolidaySettings({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  // Holidays
  const currentYear = Math.max(MIN_ALLOWED_YEAR, getCalendarYear());
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
    setNewName('');
  }, [selectedYear]);

  const holidaysQuery = useQuery(holidayYearQuery(selectedYear));
  const holidays = holidaysQuery.data ?? [];

  const invalidateHolidays = () => {
    queryClient.invalidateQueries({ queryKey: ['settings', 'holidays'] });
    queryClient.invalidateQueries({ queryKey: ['summary'] });
  };

  const saveHolidayMutation = useMutation({
    mutationFn: settingsApi.saveHoliday,
    onSuccess: () => {
      invalidateHolidays();
      setNewName('');
      toast.success('节假日规则已保存');
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: settingsApi.deleteHoliday,
    onSuccess: () => {
      invalidateHolidays();
      toast.success('已删除该条规则');
    },
    onError: (error) => toast.error(error.message),
  });

  const syncHolidaysMutation = useMutation({
    mutationFn: settingsApi.syncHolidays,
    onSuccess: (result) => {
      toast.success(`已从 GitHub 同步 ${result.year} 年节假日（${result.holidays.length} 条）`);
      invalidateHolidays();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetHolidaysMutation = useMutation({
    mutationFn: settingsApi.resetHolidays,
    onSuccess: (_, year) => {
      toast.success(`已重置 ${year} 年内置节假日`);
      invalidateHolidays();
    },
    onError: (error) => toast.error(error.message),
  });

  const holidaysBusy = saveHolidayMutation.isPending || deleteHolidayMutation.isPending ||
    syncHolidaysMutation.isPending || resetHolidaysMutation.isPending;
  const canEditHolidays = isAdmin && holidaysQuery.isSuccess && !holidaysBusy;
  const editingHoliday = holidays.some(holiday => holiday.date === newDate);

  const handleSaveHoliday = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEditHolidays) return;
    if (!newDate.startsWith(`${selectedYear}-`) || !newName.trim()) {
      toast.error(`请输入 ${selectedYear} 年内的日期与名称`);
      return;
    }
    saveHolidayMutation.mutate({ date: newDate, name: newName.trim(), kind: newKind });
  };

  const handleEditHoliday = (holiday: HolidayOverride) => {
    setNewDate(holiday.date);
    setNewName(holiday.name);
    setNewKind(holiday.kind);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600 dark:text-zinc-400">年份：</span>
          <SelectField
            value={selectedYear}
            aria-label="节假日年份"
            disabled={holidaysBusy}
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
            来源：GitHub holiday-cn（支持 2026 年及以后的数据，各年份分别保存）
          </span>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              loading={syncHolidaysMutation.isPending}
              disabled={!canEditHolidays}
              onClick={() => {
                if (window.confirm(`同步会替换 ${selectedYear} 年的节假日规则，确定同步？`)) syncHolidaysMutation.mutate(selectedYear);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              从 GitHub 同步
            </Button>
            <Button
              size="xs"
              variant="outline"
              loading={resetHolidaysMutation.isPending}
              disabled={!canEditHolidays}
              onClick={() => {
                if (window.confirm(`确定重置 ${selectedYear} 年为内置节假日吗？`)) {
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
          onSubmit={handleSaveHoliday}
          className="grid grid-cols-12 items-end gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5"
        >
          <div className="col-span-4">
            <FieldLabel>日期（{selectedYear}年）</FieldLabel>
            <Input
              type="date"
              min={`${selectedYear}-01-01`}
              max={`${selectedYear}-12-31`}
              value={newDate}
              disabled={!canEditHolidays}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <div className="col-span-4">
            <FieldLabel>名称</FieldLabel>
            <Input
              value={newName}
              disabled={!canEditHolidays}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="如：国庆节 / 补班"
            />
          </div>
          <div className="col-span-2">
            <FieldLabel>性质</FieldLabel>
            <SelectField
              value={newKind}
              disabled={!canEditHolidays}
              onChange={(e) => setNewKind(e.target.value as 'holiday' | 'workday')}
            >
              <option value="holiday">休</option>
              <option value="workday">班</option>
            </SelectField>
          </div>
          <div className="col-span-2">
            <Button type="submit" variant="primary" size="md" className="w-full" disabled={!canEditHolidays} loading={saveHolidayMutation.isPending}>
              {editingHoliday ? '保存' : '添加'}
            </Button>
          </div>
        </form>
      )}

      {holidaysQuery.isError && <QueryError message="无法加载节假日规则" retry={() => void holidaysQuery.refetch()} />}
      {holidaysQuery.isLoading && <Spinner label="加载节假日..." />}
      {holidaysQuery.data && (
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
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" aria-label={`编辑 ${h.name}`} disabled={!canEditHolidays} onClick={() => handleEditHoliday(h)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`删除 ${h.name}`} disabled={!canEditHolidays}
                      className="text-slate-400 hover:text-red-600" onClick={() => {
                        if (window.confirm(`确定删除 ${h.date} 的「${h.name}」规则？`)) deleteHolidayMutation.mutate(h.date);
                      }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
