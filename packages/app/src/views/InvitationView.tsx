import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { LoginResponse } from '@calendar/shared';
import { teamApi } from '../api/team';
import { Button, Input, Spinner } from '../components/ui/primitives';

interface Props {
  token: string;
  onAccepted: (session: LoginResponse) => void;
  onClose: () => void;
}

export function InvitationView({ token, onAccepted, onClose }: Props) {
  const [password, setPassword] = useState('');
  const invitation = useQuery({
    queryKey: ['invitation', token],
    queryFn: ({ signal }) => teamApi.previewInvitation(token, signal),
    retry: false,
    gcTime: 0,
  });
  const accept = useMutation({
    mutationFn: (value: string) => teamApi.acceptInvitation(token, value),
    onSuccess: onAccepted,
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold">接受团队邀请</h1>
        {invitation.isPending && <Spinner label="正在验证邀请链接…" />}
        {invitation.isError && (
          <div role="alert" className="space-y-2 text-sm">
            <p>{invitation.error.message}</p>
            <Button size="sm" variant="outline" onClick={() => void invitation.refetch()}>重试</Button>
          </div>
        )}
        {invitation.data && (
          <form className="space-y-4" onSubmit={event => {
            event.preventDefault();
            accept.mutate(password);
          }}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {invitation.data.name}，你将以「{invitation.data.roleLabel}」身份加入团队。
              登录账号为 <strong>{invitation.data.username}</strong>。
            </p>
            <div>
              <label htmlFor="invitation-password" className="text-sm font-medium">设置密码</label>
              <Input id="invitation-password" type="password" autoComplete="new-password" minLength={6} required
                disabled={accept.isPending} value={password} onChange={event => setPassword(event.target.value)}
              />
              <p className="mt-1 text-xs text-zinc-500">至少 6 个字符。</p>
            </div>
            {accept.isError && <p role="alert" className="text-sm text-rose-600">{accept.error.message}</p>}
            <Button type="submit" variant="primary" loading={accept.isPending}>加入团队</Button>
          </form>
        )}
        <Button variant="ghost" onClick={onClose} disabled={accept.isPending}>返回</Button>
      </section>
    </main>
  );
}
