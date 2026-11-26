import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ResetScope } from '@calendar/shared';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUserLocal, LOCAL_MODE, settingsApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useUiStore } from '../../store/uiStore';
import { Button } from '../ui/primitives';

interface Props {
  isAdmin: boolean;
}

export function ResetSettings({ isAdmin }: Props) {
  const queryClient = useQueryClient();
  const resetUiState = useUiStore(state => state.resetUiState);
  const setTheme = useThemeStore(state => state.setTheme);
  const updateCurrentUser = useAuthStore(state => state.updateCurrentUser);

  const resetMutation = useMutation({
    mutationFn: (scope: ResetScope) => settingsApi.resetWorkspace(scope),
    onSuccess: async ({ scope }) => {
      resetUiState();
      if (scope === 'factory' || scope === 'personal') {
        setTheme('auto');
      }
      if (scope === 'factory' && LOCAL_MODE) {
        const localUser = await getCurrentUserLocal();
        updateCurrentUser(localUser);
      }
      await queryClient.invalidateQueries();
      if (scope === 'personal') {
        toast.success('已清空本人请假记录并重置界面偏好');
      } else if (scope === 'schedule') {
        toast.success('已清空全部排期数据');
      } else {
        toast.success('已恢复到初始化状态');
      }
    },
    onError: error => toast.error(error instanceof Error ? error.message : '重置失败'),
  });

  const runReset = (scope: ResetScope, confirmMessage: string) => {
    if (!window.confirm(confirmMessage)) return;
    resetMutation.mutate(scope);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">重置我的数据与偏好</h4>
            <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              清空你本人提交的所有请假记录，并将筛选条件、日历布局与外观主题恢复默认。不会影响管理员分配给你的任务或其他成员的数据。
            </p>
          </div>
          <Button
            size="sm"
            variant="danger"
            loading={resetMutation.isPending}
            onClick={() => runReset(
              'personal',
              '确定清空你本人的全部请假记录，并恢复默认界面偏好吗？此操作不可撤销。',
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置我的数据
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">清空排期数据</h4>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            清空所有成员的任务与请假记录，恢复默认筛选视图；保留成员、项目、工作时段与节假日配置。
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          loading={resetMutation.isPending && resetMutation.variables === 'schedule'}
          disabled={resetMutation.isPending}
          onClick={() => runReset(
            'schedule',
            '确定清空所有成员的任务与请假记录吗？成员、项目和节假日配置会保留，此操作不可撤销。',
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          清空排期数据
        </Button>
      </div>

      <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 p-4 space-y-3">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-400">恢复初始化状态</h4>
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {LOCAL_MODE
              ? '清空全部任务、请假、自定义排期人员与项目，工作时段、节假日与外观主题全部恢复为初始默认状态。'
              : '清空全部任务、请假、自定义项目以及其他成员账号与邀请（仅保留当前管理员账号），工作时段、节假日、角色名称与外观主题全部恢复默认。'}
          </p>
        </div>
        <Button
          size="sm"
          variant="danger"
          loading={resetMutation.isPending && resetMutation.variables === 'factory'}
          disabled={resetMutation.isPending}
          onClick={() => runReset(
            'factory',
            LOCAL_MODE
              ? '确定将本地工作区彻底恢复为初始化状态吗？所有排期、自定义成员和项目都将被清空，此操作不可撤销。'
              : '确定将整个团队工作区恢复为初始化状态吗？所有排期、自定义项目和其他成员账号将被删除（仅保留当前管理员），此操作不可撤销。',
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          恢复初始化状态
        </Button>
      </div>
    </div>
  );
}
