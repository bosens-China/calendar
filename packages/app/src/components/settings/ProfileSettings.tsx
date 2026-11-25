import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Member } from '@calendar/shared';
import { toast } from 'sonner';
import { LOCAL_MODE, membersApi } from '../../api';
import { teamApi } from '../../api/team';
import { useAuthStore } from '../../store/authStore';
import { Button, Input } from '../ui/primitives';

export function ProfileSettings({ user }: { user: Member }) {
  const [name, setName] = useState(user.name);
  const updateCurrentUser = useAuthStore(state => state.updateCurrentUser);
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: (value: string) => LOCAL_MODE
      ? membersApi.updateMember(user.id, { name: value })
      : teamApi.updateProfile(value),
    onSuccess: member => {
      updateCurrentUser(member);
      void client.invalidateQueries({ queryKey: ['members'] });
      void client.invalidateQueries({ queryKey: ['summary'] });
      toast.success('姓名已更新');
    },
    onError: error => toast.error(error.message),
  });
  return (
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); save.mutate(name.trim()); }}>
      {!LOCAL_MODE && <p className="text-sm text-zinc-500">登录账号 {user.username}</p>}
      <label className="block text-sm">姓名
        <Input value={name} maxLength={80} required onChange={event => setName(event.target.value)} disabled={save.isPending} />
      </label>
      <Button type="submit" variant="primary" disabled={!name.trim() || name.trim() === user.name} loading={save.isPending}>保存姓名</Button>
    </form>
  );
}
