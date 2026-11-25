import { useState } from 'react';
import type { Member, RoleLabels, UserRole } from '@calendar/shared';
import type { ManagedMemberInput } from '../../api';
import { LOCAL_MODE } from '../../api';
import { Button, Input, SelectField } from '../ui/primitives';

interface Props {
  member?: Member;
  labels: RoleLabels;
  pending: boolean;
  close: () => void;
  save: (input: ManagedMemberInput) => void;
}

export function MemberForm({ member, labels, pending, close, save }: Props) {
  const [name, setName] = useState(member?.name ?? '');
  const [username, setUsername] = useState(member?.username ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [title, setTitle] = useState(member?.title ?? '');
  const [role, setRole] = useState<UserRole>(member?.role ?? 'member');
  const [color, setColor] = useState(member?.avatarColor);

  return (
    <form className="space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" onSubmit={event => {
      event.preventDefault();
      save({
        name: name.trim(), title: title.trim(),
        ...(color && { avatarColor: color }),
        ...(!LOCAL_MODE && { username: username.trim(), email: email.trim(), role }),
      });
    }}>
      {!LOCAL_MODE && !member && <p className="text-sm text-zinc-500">填写账号和权限角色。对方打开邀请链接后自行设置密码。</p>}
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2" disabled={pending}>
        {!LOCAL_MODE && (
          <label className="text-sm">登录账号
            <Input required disabled={Boolean(member)} value={username} onChange={event => setUsername(event.target.value)} />
          </label>
        )}
        <label className="text-sm">姓名
          <Input required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="如：张三" />
        </label>
        <label className="text-sm">职位或标签
          <Input value={title} onChange={event => setTitle(event.target.value)} />
        </label>
        {!LOCAL_MODE && (
          <>
            <label className="text-sm">邮箱（可选）
              <Input type="email" value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label className="text-sm">权限角色
              <SelectField value={role} onChange={event => setRole(event.target.value === 'admin' ? 'admin' : 'member')}>
                <option value="member">{labels.member}</option>
                <option value="admin">{labels.admin}</option>
              </SelectField>
            </label>
          </>
        )}
        <label className="text-sm">排期颜色
          <Input type="color" className="w-16" value={color ?? '#2563eb'} onChange={event => setColor(event.target.value)} />
        </label>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={close} disabled={pending}>取消</Button>
        <Button type="submit" variant="primary" loading={pending} disabled={!name.trim() || (!LOCAL_MODE && !username.trim())}>
          {LOCAL_MODE || member ? '保存' : '生成邀请链接'}
        </Button>
      </div>
    </form>
  );
}
