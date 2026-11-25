import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, CalendarOff, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  HolidayOverride,
  Leave,
  LeaveType,
  Member,
  Project,
  Task,
  TaskPriority,
  TaskStatus,
  WorkSlot,
} from '@calendar/shared';
import { formatHours } from '@calendar/shared';
import { leavesApi, tasksApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { clampDateMin, dayjs, MIN_ALLOWED_DATE } from '../../utils/date';
import { calculateTaskEffectiveMinutes, LEAVE_TYPE_CONFIG } from '../../utils/scheduleHelper';
import { ModalDialog } from '../ui/overlays';
import { Button, cn, FieldLabel, Input, SelectField, Textarea } from '../ui/primitives';

export type ScheduleEntryMode = 'task' | 'leave';

interface Props {
  open: boolean;
  initialMode?: ScheduleEntryMode;
  editingTask?: Task | null;
  editingLeave?: Leave | null;
  initialTaskValues?: Partial<Task>;
  initialLeaveMemberId?: string;
  initialDate?: string;
  projects: Project[];
  members: Member[];
  workSlots: WorkSlot[];
  holidayMap: Map<string, HolidayOverride>;
  onClose: () => void;
  onSuccess: () => void;
}

export const ScheduleCreateModal: React.FC<Props> = ({
  open,
  initialMode = 'task',
  editingTask,
  editingLeave,
  initialTaskValues,
  initialLeaveMemberId,
  initialDate,
  projects,
  members,
  workSlots,
  holidayMap,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [mode, setMode] = useState<ScheduleEntryMode>(isAdmin ? initialMode : 'leave');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const defaultToday = clampDateMin(dayjs().format('YYYY-MM-DD'));
  const firstStart = workSlots[0]?.startTime || '09:00';
  const lastEnd = workSlots[workSlots.length - 1]?.endTime || '18:00';

  // Task fields
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [description, setDescription] = useState('');

  // Leave fields
  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [reason, setReason] = useState('');

  // Shared span fields
  const [startDate, setStartDate] = useState(defaultToday);
  const [startTime, setStartTime] = useState(firstStart);
  const [endDate, setEndDate] = useState(defaultToday);
  const [endTime, setEndTime] = useState(lastEnd);

  const isEditing = Boolean(editingTask || editingLeave);
  const isMemberAdjusting = !isAdmin && Boolean(editingTask);

  useEffect(() => {
    if (!open) return;
    if (editingTask) {
      setMode('task');
      setTitle(editingTask.title);
      setProjectId(editingTask.projectId);
      setAssigneeId(editingTask.assigneeId);
      setStatus(editingTask.status);
      setPriority(editingTask.priority);
      setDescription(editingTask.description || '');
      setStartDate(clampDateMin(editingTask.startDate));
      setStartTime(editingTask.startTime);
      setEndDate(clampDateMin(editingTask.endDate));
      setEndTime(editingTask.endTime === '24:00' ? '23:59' : editingTask.endTime);
    } else if (editingLeave) {
      setMode('leave');
      setAssigneeId(editingLeave.memberId);
      setLeaveType(editingLeave.type);
      setReason(editingLeave.reason || '');
      setStartDate(clampDateMin(editingLeave.startDate));
      setStartTime(editingLeave.startTime);
      setEndDate(clampDateMin(editingLeave.endDate));
      setEndTime(editingLeave.endTime === '24:00' ? '23:59' : editingLeave.endTime);
    } else {
      const m = isAdmin ? initialMode : 'leave';
      setMode(m);
      setTitle('');
      setDescription('');
      setReason('');
      setStatus('todo');
      setPriority('medium');
      setLeaveType('annual');
      setProjectId(projects[0]?.id || '');
      const defaultMember =
        initialLeaveMemberId ||
        initialTaskValues?.assigneeId ||
        user?.id ||
        members[0]?.id ||
        '';
      setAssigneeId(isAdmin ? defaultMember : user?.id || defaultMember);
      const d = clampDateMin(initialDate || initialTaskValues?.startDate || defaultToday);
      setStartDate(d);
      setEndDate(clampDateMin(initialTaskValues?.endDate || d));
      setStartTime(initialTaskValues?.startTime || firstStart);
      setEndTime(initialTaskValues?.endTime || lastEnd);
    }
  }, [
    open,
    editingTask,
    editingLeave,
    initialMode,
    initialTaskValues,
    initialLeaveMemberId,
    initialDate,
    isAdmin,
    projects,
    members,
    user?.id,
    defaultToday,
    firstStart,
    lastEnd,
  ]);

  const effectiveMinutes = useMemo(() => {
    if (!startDate || !endDate || !startTime || !endTime) return 0;
    return calculateTaskEffectiveMinutes(
      { startDate, startTime, endDate, endTime },
      workSlots,
      holidayMap,
    );
  }, [startDate, startTime, endDate, endTime, workSlots, holidayMap]);

  const applyPreset = (preset: 'morning' | 'afternoon' | 'fullday') => {
    const first = workSlots[0];
    const last = workSlots[workSlots.length - 1];
    if (preset === 'morning' && first) {
      setStartTime(first.startTime);
      setEndTime(first.endTime);
      setEndDate(startDate);
    } else if (preset === 'afternoon' && last) {
      setStartTime(last.startTime);
      setEndTime(last.endTime);
      setEndDate(startDate);
    } else {
      setStartTime(first?.startTime || '09:00');
      setEndTime(last?.endTime || '18:00');
      setEndDate(startDate);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate < MIN_ALLOWED_DATE || endDate < MIN_ALLOWED_DATE) {
      toast.error('不支持选择 2026 年之前的日期');
      return;
    }
    if (`${startDate} ${startTime}` >= `${endDate} ${endTime}`) {
      toast.error('结束时间必须晚于开始时间');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'task') {
        if (!isMemberAdjusting && (!title.trim() || !projectId || !assigneeId)) {
          toast.error('请填写任务标题、所属项目与负责人');
          setSaving(false);
          return;
        }
        if (editingTask) {
          if (isMemberAdjusting) {
            await tasksApi.updateTask(editingTask.id, {
              status,
              description,
              startDate,
              startTime,
              endDate,
              endTime,
            });
          } else {
            await tasksApi.updateTask(editingTask.id, {
              title: title.trim(),
              projectId,
              assigneeId,
              status,
              priority,
              description,
              startDate,
              startTime,
              endDate,
              endTime,
            });
          }
          toast.success(isMemberAdjusting ? '任务微调已保存' : '任务已更新');
        } else {
          await tasksApi.createTask({
            title: title.trim(),
            projectId,
            assigneeId,
            status,
            priority,
            description,
            startDate,
            startTime,
            endDate,
            endTime,
          });
          toast.success('任务已创建');
        }
      } else {
        if (editingLeave) {
          await leavesApi.updateLeave(editingLeave.id, {
            ...(isAdmin && assigneeId ? { memberId: assigneeId } : {}),
            startDate,
            startTime,
            endDate,
            endTime,
            type: leaveType,
            reason,
          });
          toast.success('请假记录已更新');
        } else {
          await leavesApi.createLeave({
            memberId: isAdmin ? assigneeId : user?.id,
            startDate,
            startTime,
            endDate,
            endTime,
            type: leaveType,
            reason,
          });
          toast.success('请假已登记');
        }
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (editingTask) {
        await tasksApi.deleteTask(editingTask.id);
        toast.success('任务已删除');
      } else if (editingLeave) {
        await leavesApi.deleteLeave(editingLeave.id);
        toast.success('请假已撤销');
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const modalTitle = editingTask
    ? isMemberAdjusting
      ? '微调我的任务'
      : '编辑工作任务'
    : editingLeave
      ? '编辑请假记录'
      : mode === 'task'
        ? '新建排期'
        : '登记请假';

  return (
    <ModalDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={modalTitle}
      maxWidthClass="max-w-lg"
      headerExtra={
        !isEditing && isAdmin ? (
          <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode('task')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
                mode === 'task'
                  ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
              )}
            >
              <Briefcase className="h-3.5 w-3.5" />
              工作任务
            </button>
            <button
              type="button"
              onClick={() => setMode('leave')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer',
                mode === 'leave'
                  ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
              )}
            >
              <CalendarOff className="h-3.5 w-3.5" />
              请假
            </button>
          </div>
        ) : undefined
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isMemberAdjusting && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-800">
            你可以微调此任务的起止时间、状态与进展备注，系统会自动标记「已微调」。
          </div>
        )}

        {mode === 'task' ? (
          <>
            <div>
              <FieldLabel required>任务标题</FieldLabel>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isMemberAdjusting}
                placeholder="例如：完成首页画布交互开发"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>所属项目</FieldLabel>
                <SelectField
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={isMemberAdjusting}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div>
                <FieldLabel required>负责人</FieldLabel>
                <SelectField
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={isMemberAdjusting}
                >
                  {members
                    .filter((m) => m.active || m.id === assigneeId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </SelectField>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>任务状态</FieldLabel>
                <SelectField value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                  <option value="todo">待开始</option>
                  <option value="in_progress">进行中</option>
                  <option value="done">已完成</option>
                  <option value="delayed">已延期</option>
                </SelectField>
              </div>
              <div>
                <FieldLabel>优先级</FieldLabel>
                <SelectField
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  disabled={isMemberAdjusting}
                >
                  <option value="high">高优先级</option>
                  <option value="medium">中优先级</option>
                  <option value="low">低优先级</option>
                </SelectField>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>请假人员</FieldLabel>
              <SelectField
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={!isAdmin}
              >
                {members
                  .filter((m) => m.active || m.id === assigneeId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </SelectField>
            </div>
            <div>
              <FieldLabel required>请假类型</FieldLabel>
              <SelectField
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              >
                {(Object.keys(LEAVE_TYPE_CONFIG) as LeaveType[]).map((k) => (
                  <option key={k} value={k}>
                    {LEAVE_TYPE_CONFIG[k].label}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        )}

        {/* Quick Time Presets */}
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              快捷时段（自动跳过午休与休假日）
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="xs" variant="outline" onClick={() => applyPreset('morning')}>
                上午
              </Button>
              <Button size="xs" variant="outline" onClick={() => applyPreset('afternoon')}>
                下午
              </Button>
              <Button size="xs" variant="outline" onClick={() => applyPreset('fullday')}>
                全天
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <FieldLabel required>开始日期</FieldLabel>
              <Input
                type="date"
                min={MIN_ALLOWED_DATE}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel required>开始时间</FieldLabel>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel required>结束日期</FieldLabel>
              <Input
                type="date"
                min={MIN_ALLOWED_DATE}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel required>结束时间</FieldLabel>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span>
              有效工作时长：
              <strong className="text-zinc-900 dark:text-zinc-100">
                {formatHours(effectiveMinutes)}
              </strong>
            </span>
          </div>
        </div>

        <div>
          <FieldLabel>{mode === 'task' ? '备注 / 进展说明' : '请假事由'}</FieldLabel>
          <Textarea
            rows={2}
            value={mode === 'task' ? description : reason}
            onChange={(e) =>
              mode === 'task' ? setDescription(e.target.value) : setReason(e.target.value)
            }
            placeholder={mode === 'task' ? '可选，记录任务细节或最新进度...' : '可选，说明请假原因...'}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            {((editingTask && isAdmin) ||
              (editingLeave && (isAdmin || editingLeave.memberId === user?.id))) && (
              <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                {editingTask ? '删除任务' : '撤销请假'}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {isEditing ? '保存修改' : mode === 'task' ? '创建任务' : '提交请假'}
            </Button>
          </div>
        </div>
      </form>
    </ModalDialog>
  );
};
