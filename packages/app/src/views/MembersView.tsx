import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { InvitationLink, Member, UpdateMemberRequest } from '@calendar/shared';
import { invitationCreate } from '@calendar/shared';
import { LOCAL_MODE, membersApi, type ManagedMemberInput } from '../api';
import { teamApi } from '../api/team';
import { useAuthStore } from '../store/authStore';
import { useRoleLabels } from '../hooks/useRoleLabels';
import { MemberForm } from '../components/members/MemberForm';
import { MemberInvitationLink } from '../components/members/MemberInvitationLink';
import { MemberRow } from '../components/members/MemberRow';
import { QueryError } from '../components/ui/QueryError';
import { Button, Input, Spinner } from '../components/ui/primitives';

type Action = 'create' | 'edit' | 'reset';

export function MembersView() {
  const client = useQueryClient();
  const { user, updateCurrentUser } = useAuthStore();
  const { labels } = useRoleLabels();
  const [action, setAction] = useState<Action>();
  const [target, setTarget] = useState<Member>();
  const [password, setPassword] = useState('');
  const [invitation, setInvitation] = useState<InvitationLink>();
  const roster = useQuery({
    queryKey: ['members'],
    queryFn: ({ signal }) => membersApi.getMembers(signal),
  });

  function invalidateRoster() {
    client.invalidateQueries({ queryKey: ['members'] });
    client.invalidateQueries({ queryKey: ['summary'] });
  }

  function open(next: Action, member?: Member) {
    setTarget(member);
    setAction(next);
    setPassword('');
    setInvitation(undefined);
  }

  const create = useMutation({
    mutationFn: async (profile: ManagedMemberInput) => {
      if (LOCAL_MODE) {
        await membersApi.createMember(profile);
        return undefined;
      }
      return teamApi.inviteMember(invitationCreate.parse(profile));
    },
    onSuccess: result => {
      invalidateRoster();
      setAction(undefined);
      setInvitation(result);
      if (!result) toast.success('已添加排期人员');
    },
    onError: error => toast.error(error.message),
  });
  const edit = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: UpdateMemberRequest }) => membersApi.updateMember(id, fields),
    onSuccess: member => {
      updateCurrentUser(member);
      invalidateRoster();
      setAction(undefined);
      toast.success('成员信息已更新');
    },
    onError: error => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: membersApi.deleteMember,
    onSuccess: () => {
      invalidateRoster();
      client.invalidateQueries({ queryKey: ['tasks'] });
      client.invalidateQueries({ queryKey: ['leaves'] });
      toast.success('已删除成员');
    },
    onError: error => toast.error(error.message),
  });
  const renew = useMutation({
    mutationFn: teamApi.renewInvitation,
    onSuccess: result => setInvitation(result),
    onError: error => toast.error(error.message),
  });
  const revoke = useMutation({
    mutationFn: teamApi.revokeInvitation,
    onSuccess: () => {
      setInvitation(undefined);
      toast.success('邀请已撤销');
    },
    onError: error => toast.error(error.message),
  });
  const reset = useMutation({
    mutationFn: (member: Member) => membersApi.resetPassword(member.id, { newPassword: password }),
    onSuccess: () => {
      setAction(undefined);
      toast.success('密码已重置');
    },
    onError: error => toast.error(error.message),
  });
  const busy = create.isPending || edit.isPending || remove.isPending || renew.isPending || revoke.isPending || reset.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">共 {roster.data?.length ?? 0} 人</span>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => open('create')}>
          {LOCAL_MODE ? '添加排期人员' : '邀请成员'}
        </Button>
      </div>
      {(action === 'create' || action === 'edit') && (
        <MemberForm key={target?.id ?? 'new'} member={target} labels={labels} pending={busy}
          close={() => setAction(undefined)} save={input => {
            if (action === 'edit' && target) {
              const { name, title, avatarColor, email, role } = input;
              edit.mutate({ id: target.id, fields: { name, title, avatarColor, email, role } });
            } else create.mutate(input);
          }}
        />
      )}
      {action === 'reset' && target && (
        <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); reset.mutate(target); }}>
          <label className="text-sm">为「{target.name}」设置新密码
            <Input type="password" autoComplete="new-password" minLength={6} required value={password}
              onChange={event => setPassword(event.target.value)} disabled={busy}
            />
          </label>
          <Button type="submit" variant="primary" loading={reset.isPending}>确认重置密码</Button>
          <Button onClick={() => setAction(undefined)} disabled={busy}>取消</Button>
        </form>
      )}
      {invitation && !LOCAL_MODE && <MemberInvitationLink key={invitation.token} invitation={invitation} onClose={() => setInvitation(undefined)} />}
      {roster.isError && <QueryError message="无法加载成员名单" retry={() => void roster.refetch()} />}
      {roster.isLoading && <Spinner label="正在加载成员…" />}
      {roster.data && (
        <div className="divide-y rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {roster.data.map(member => (
            <MemberRow key={member.id} member={member} labels={labels} self={member.id === user?.id} busy={busy}
              edit={() => open('edit', member)}
              toggle={() => edit.mutate({ id: member.id, fields: { active: !member.active } })}
              remove={() => {
                if (window.confirm(`确定删除「${member.name}」及其任务和请假吗？`)) remove.mutate(member.id);
              }}
              reset={() => open('reset', member)}
              renew={() => renew.mutate(member.id)}
              revoke={() => {
                if (window.confirm(`确定撤销发给「${member.name}」的邀请吗？`)) revoke.mutate(member.id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
