import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsApi } from '../../api';
import { QueryError } from '../ui/QueryError';
import { Badge, Button, Input, Spinner } from '../ui/primitives';
import { Plus, Save, Trash2 } from 'lucide-react';
import { formatHours, type WorkSlot } from '@calendar/shared';
import { calculateSlotMinutes } from '../../utils/scheduleHelper';

export function WorkSlotsSettings({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  // Work Slots
  const [localSlots, setLocalSlots] = useState<WorkSlot[]>([]);
  const [dirtySlots, setDirtySlots] = useState(false);

  const slotsQuery = useQuery({
    queryKey: ['settings', 'workSlots'],
    queryFn: ({ signal }) => settingsApi.getWorkSlots(signal),
  });

  useEffect(() => {
    if (slotsQuery.data && !dirtySlots) setLocalSlots(slotsQuery.data);
  }, [slotsQuery.data, dirtySlots]);

  const saveSlotsMutation = useMutation({
    mutationFn: (slots: WorkSlot[]) => settingsApi.updateWorkSlots(slots),
    onSuccess: (slots) => {
      queryClient.setQueryData(['settings', 'workSlots'], slots);
      toast.success('工作时段已保存');
      setDirtySlots(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'workSlots'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '保存失败'),
  });

  const canEditSlots = isAdmin && slotsQuery.isSuccess && !saveSlotsMutation.isPending;

  const totalDayMinutes = localSlots.reduce((acc, s) => acc + calculateSlotMinutes(s), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5">
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          标准日工时：
          <strong className="text-zinc-900 dark:text-zinc-100">
            {slotsQuery.data ? formatHours(totalDayMinutes) : '—'}
          </strong>
          <span className="ml-2 text-zinc-400">（午休与非工作时间自动跳过不展示）</span>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              variant="outline"
              disabled={!canEditSlots}
              onClick={() => {
                setLocalSlots([
                  ...localSlots,
                  {
                    id: crypto.randomUUID(),
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
              disabled={!dirtySlots || !canEditSlots}
              loading={saveSlotsMutation.isPending}
              onClick={() => saveSlotsMutation.mutate(localSlots)}
            >
              <Save className="h-3.5 w-3.5" />
              保存配置
            </Button>
          </div>
        )}
      </div>

      {slotsQuery.isError && <QueryError message="无法加载工作时段" retry={() => void slotsQuery.refetch()} />}
      {slotsQuery.isLoading ? (
        <Spinner label="加载工作时段..." />
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          {localSlots.map((slot, idx) => (
            <div key={slot.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
              <div className="col-span-4">
                <Input
                  value={slot.label}
                  disabled={!canEditSlots}
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
                  disabled={!canEditSlots}
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
                  disabled={!canEditSlots}
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
                    disabled={!canEditSlots}
                    aria-label="移除时段"
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
    </div>
  );
}
