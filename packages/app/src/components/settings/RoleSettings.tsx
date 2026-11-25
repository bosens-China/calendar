import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RoleLabels } from '@calendar/shared';
import { toast } from 'sonner';
import { teamApi } from '../../api/team';
import { roleLabelsKey, useRoleLabels } from '../../hooks/useRoleLabels';
import { QueryError } from '../ui/QueryError';
import { Button, Input, Spinner } from '../ui/primitives';

export function RoleSettings() {
  const query = useRoleLabels();
  const [draft, setDraft] = useState<RoleLabels>();
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: teamApi.saveRoleLabels,
    onSuccess: labels => {
      client.setQueryData(roleLabelsKey, labels);
      setDraft(undefined);
      toast.success('角色显示名称已更新');
    },
    onError: error => toast.error(error.message),
  });
  const values = draft ?? query.labels;

  if (query.isPending) return <Spinner label="正在加载角色显示名称…" />;
  if (query.isError) return <QueryError message="无法加载角色显示名称" retry={() => void query.refetch()} />;

  return (
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); save.mutate(values); }}>
      <p className="text-sm text-zinc-500">显示名称用于人员管理和邀请页面。管理员与成员的权限按原角色执行。</p>
      {(['admin', 'member'] as const).map(role => (
        <label key={role} className="block text-sm">{role === 'admin' ? '管理员的显示名称' : '成员的显示名称'}
          <Input value={values[role]} required maxLength={24} disabled={save.isPending}
            onChange={event => setDraft({ ...values, [role]: event.target.value })}
          />
        </label>
      ))}
      <Button type="submit" variant="primary" loading={save.isPending} disabled={!draft}>保存角色显示名称</Button>
    </form>
  );
}
