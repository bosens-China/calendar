import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, KeyRound, Plus, Trash2, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import type {
  CreateMemberRequest,
  Member,
  ResetPasswordRequest,
  UpdateMemberRequest,
  UserRole,
} from '@calendar/shared';
import { membersApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { AVATAR_PALETTE } from '../utils/scheduleHelper';
import { Badge, Button, cn, FieldLabel, Input, SelectField, Spinner } from '../components/ui/primitives';

export const MembersView: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [mode, setMode] = useState<'none' | 'create' | 'edit' | 'reset'>('none');
  const [target, setTarget] = useState<Member | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [avatarColor, setAvatarColor] = useState<string | undefined>(undefined);
  const [newPassword, setNewPassword] = useState('');

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: membersApi.getMembers,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: ['summary'] });
  };

  const createMutation = useMutation({
    mutationFn: (dto: CreateMemberRequest) => membersApi.createMember(dto),
    onSuccess: () => {
      toast.success('成员已创建');
      setMode('none');
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '创建失败'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateMemberRequest }) =>
      membersApi.updateMember(id, dto),
    onSuccess: () => {
      toast.success('成员信息已更新');
      setMode('none');
      setTarget(null);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '更新失败'),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ResetPasswordRequest }) =>
      membersApi.resetPassword(id, dto),
    onSuccess: () => {
      toast.success('密码已重置，旧会话已自动失效');
      setMode('none');
      setTarget(null);
      setNewPassword('');
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '重置失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => membersApi.deleteMember(id),
    onSuccess: () => {
      toast.success('成员已删除');
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : '删除失败'),
  });

  const pickUnusedColor = () => {
    const used = new Set(members.map((m) => m.avatarColor.toLowerCase()));
    const unused = AVATAR_PALETTE.filter((c) => !used.has(c.toLowerCase()));
    return unused.length > 0 ? unused[Math.floor(Math.random() * unused.length)] : undefined;
  };

  const openCreate = () => {
    setTarget(null);
    setUsername('');
    setPassword('');
    setName('');
    setEmail('');
    setTitle('');
    setRole('member');
    setAvatarColor(pickUnusedColor());
    setMode('create');
  };

  const openEdit = (m: Member) => {
    setTarget(m);
    setName(m.name);
    setEmail(m.email || '');
    setTitle(m.title || '');
    setRole(m.role);
    setAvatarColor(m.avatarColor);
    setMode('edit');
  };

  const openReset = (m: Member) => {
    setTarget(m);
    setNewPassword('');
    setMode('reset');
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'create') {
      if (!username.trim() || !name.trim() || password.length < 6) {
        toast.error('请填写用户名、姓名，且初始密码不少于 6 位');
        return;
      }
      createMutation.mutate({
        username: username.trim(),
        password,
        name: name.trim(),
        email: email.trim(),
        title: title.trim(),
        role,
        ...(avatarColor ? { avatarColor } : {}),
      });
    } else if (mode === 'edit' && target) {
      if (!name.trim()) {
        toast.error('请输入姓名');
        return;
      }
      updateMutation.mutate({
        id: target.id,
        dto: {
          name: name.trim(),
          email: email.trim(),
          title: title.trim(),
          role,
          avatarColor,
        },
      });
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || newPassword.length < 6) {
      toast.error('新密码不少于 6 位');
      return;
    }
    resetMutation.mutate({ id: target.id, dto: { newPassword } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">共 {members.length} 名成员</span>
        <Button size="sm" variant="primary" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          添加成员
        </Button>
      </div>

      {(mode === 'create' || mode === 'edit') && (
        <form
          onSubmit={handleSaveMember}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950 p-4 space-y-3"
        >
          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            {mode === 'create' ? '添加新成员（自动分配不重复专属色）' : `编辑成员：${target?.name}`}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode === 'create' && (
              <>
                <div>
                  <FieldLabel required>登录账号</FieldLabel>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="例如：zhangsan"
                  />
                </div>
                <div>
                  <FieldLabel required>初始密码（≥6位）</FieldLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 位"
                  />
                </div>
              </>
            )}
            <div>
              <FieldLabel required>真实姓名</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：张三" />
            </div>
            <div>
              <FieldLabel>绑定邮箱（用于忘记密码）</FieldLabel>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="如：zhangsan@company.com"
              />
            </div>
            <div>
              <FieldLabel>职位 / 标签</FieldLabel>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：前端研发" />
            </div>
            <div>
              <FieldLabel>角色权限</FieldLabel>
              <SelectField value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="member">团队成员（仅看/微调自己）</option>
                <option value="admin">系统管理员</option>
              </SelectField>
            </div>
          </div>

          <div>
            <FieldLabel>专属颜色标识</FieldLabel>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {AVATAR_PALETTE.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setAvatarColor(hex)}
                  className={cn(
                    'h-5 w-5 rounded-full cursor-pointer transition-transform',
                    avatarColor?.toLowerCase() === hex.toLowerCase() &&
                      'ring-2 ring-slate-900 ring-offset-2 scale-110',
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setMode('none')}>
              取消
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              保存
            </Button>
          </div>
        </form>
      )}

      {mode === 'reset' && target && (
        <form
          onSubmit={handleResetPassword}
          className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3"
        >
          <div className="text-xs font-semibold text-amber-900">
            重置「{target.name}」的登录密码
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码（至少 6 位）"
              className="max-w-xs bg-white"
            />
            <Button type="submit" variant="primary" loading={resetMutation.isPending}>
              确认重置
            </Button>
            <Button variant="outline" onClick={() => setMode('none')}>
              取消
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="py-10">
          <Spinner label="加载成员中..." />
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          {members.map((m) => {
            const isSelf = m.id === user?.id;
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: m.avatarColor }}
                  >
                    {(m.name || m.username).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {m.name}
                      </span>
                      <Badge tone={m.role === 'admin' ? 'purple' : 'blue'}>
                        {m.role === 'admin' ? '管理员' : '成员'}
                      </Badge>
                      {!m.active && <Badge tone="red">已停用</Badge>}
                    </div>
                    <div className="truncate text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      @{m.username}
                      {m.email ? ` · ${m.email}` : ' · 未设邮箱'}
                      {m.title ? ` · ${m.title}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="xs" variant="ghost" onClick={() => openEdit(m)}>
                    <Edit2 className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => openReset(m)}>
                    <KeyRound className="h-3.5 w-3.5" />
                    重置密码
                  </Button>
                  {!isSelf && (
                    <>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          updateMutation.mutate({ id: m.id, dto: { active: !m.active } })
                        }
                      >
                        {m.active ? (
                          <UserX className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        {m.active ? '停用' : '启用'}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          if (window.confirm(`确定删除成员「${m.name}」吗？其名下任务和请假也会移除。`)) {
                            deleteMutation.mutate(m.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
