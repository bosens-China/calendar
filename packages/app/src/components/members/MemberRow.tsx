import type { Member, RoleLabels } from '@calendar/shared';
import { LOCAL_MODE } from '../../api';
import { Badge, Button } from '../ui/primitives';

interface Props {
  member: Member;
  labels: RoleLabels;
  self: boolean;
  busy: boolean;
  edit: () => void;
  toggle: () => void;
  remove: () => void;
  reset: () => void;
  renew: () => void;
  revoke: () => void;
}

export function MemberRow({ member, labels, self, busy, edit, toggle, remove, reset, renew, revoke }: Props) {
  const waitingForSignup = !LOCAL_MODE && member.pendingInvitation;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ backgroundColor: member.avatarColor }}>
          {member.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{member.name}</span>
            {!LOCAL_MODE && <Badge tone={member.role === 'admin' ? 'purple' : 'blue'}>{labels[member.role]}</Badge>}
            {waitingForSignup ? <Badge tone="amber">待开通</Badge> : !member.active && <Badge tone="red">已停用</Badge>}
          </div>
          <div className="truncate text-xs text-zinc-500">
            {[!LOCAL_MODE && `@${member.username}`, !LOCAL_MODE && member.email, member.title].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        <Button size="xs" variant="ghost" disabled={busy} onClick={edit}>编辑</Button>
        {waitingForSignup ? (
          <>
            <Button size="xs" variant="ghost" disabled={busy} onClick={renew}>重新生成邀请</Button>
            <Button size="xs" variant="ghost" disabled={busy} onClick={revoke}>撤销邀请</Button>
          </>
        ) : (
          <>
            {!LOCAL_MODE && <Button size="xs" variant="ghost" disabled={busy} onClick={reset}>重置密码</Button>}
            {!self && <Button size="xs" variant="ghost" disabled={busy} onClick={toggle}>{member.active ? '停用' : '启用'}</Button>}
          </>
        )}
        {!self && <Button size="xs" variant="ghost" className="text-rose-600" disabled={busy} onClick={remove}>删除</Button>}
      </div>
    </div>
  );
}
