import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  calendarDate, getCalendarDate, type Leave, type LeaveType, type Member, type Project, type Task,
  type TaskPriority, type TaskStatus, type WorkSlot,
} from '@calendar/shared';
import { leavesApi, tasksApi } from '../../api';
import { useHolidayRules } from '../../hooks/useHolidayRules';
import { useAuthStore } from '../../store/authStore';
import { clampDateMin, MIN_ALLOWED_DATE } from '../../utils/date';
import { calculateTaskEffectiveMinutes } from '../../utils/scheduleHelper';

export type ScheduleEntryMode = 'task' | 'leave';

export interface ScheduleEntryProps {
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
  onClose: () => void;
  onSuccess: () => void;
}

export function useScheduleEntry({
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
  onClose,
  onSuccess,
}: ScheduleEntryProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [mode, setMode] = useState<ScheduleEntryMode>(isAdmin ? initialMode : 'leave');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const defaultToday = clampDateMin(getCalendarDate());
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

  const datesValid = calendarDate.safeParse(startDate).success && calendarDate.safeParse(endDate).success && startDate <= endDate;
  const { holidayMap, hasData, isLoading, isError, retry } = useHolidayRules(startDate, endDate, open && datesValid);
  const effectiveMinutes = useMemo(() => {
    if (!hasData || !startTime || !endTime) return null;
    return calculateTaskEffectiveMinutes(
      { startDate, startTime, endDate, endTime }, workSlots, holidayMap,
    );
  }, [hasData, startDate, startTime, endDate, endTime, workSlots, holidayMap]);

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

  const handleSubmit = async (e: FormEvent) => {
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

  return {
    isAdmin, isEditing, isMemberAdjusting, mode, setMode, saving, deleting, title, setTitle,
    projectId, setProjectId, assigneeId, setAssigneeId, status, setStatus, priority, setPriority,
    description, setDescription, leaveType, setLeaveType, reason, setReason, startDate, setStartDate,
    startTime, setStartTime, endDate, setEndDate, endTime, setEndTime, applyPreset, effectiveMinutes,
    isLoading, isError, retry, handleSubmit, handleDelete,
    canDelete: editingTask ? isAdmin : editingLeave && (isAdmin || editingLeave.memberId === user?.id),
  };
}
