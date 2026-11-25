import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, Monitor, Moon, Sun, User } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '../api';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { Button, FieldLabel, Input } from '../components/ui/primitives';
import { ModalDialog } from '../components/ui/overlays';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useAuthStore();
  const { theme, cycleTheme } = useThemeStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpUsername, setFpUsername] = useState('');
  const [fpEmail, setFpEmail] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirm, setFpConfirm] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('请输入账号和密码');
      return;
    }
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
      toast.success('欢迎回来');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpUsername.trim() || !fpEmail.trim() || fpNewPassword.length < 6) {
      toast.error('请填写完整信息，且新密码不少于 6 位');
      return;
    }
    if (fpNewPassword !== fpConfirm) {
      toast.error('两次输入的密码不一致');
      return;
    }
    setFpLoading(true);
    try {
      await authApi.forgotPassword({
        username: fpUsername.trim(),
        email: fpEmail.trim(),
        newPassword: fpNewPassword,
      });
      toast.success('密码已重置，请使用新密码登录');
      setForgotOpen(false);
      setFpUsername('');
      setFpEmail('');
      setFpNewPassword('');
      setFpConfirm('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '重置失败');
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="absolute right-5 top-5">
        <Button
          size="icon"
          variant="ghost"
          onClick={cycleTheme}
          title={`当前主题：${theme === 'auto' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}（点击切换）`}
        >
          {theme === 'auto' ? (
            <Monitor className="h-4 w-4" />
          ) : theme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-zinc-800 shadow-lg">
            <img src={import.meta.env.BASE_URL + 'favicon.svg'} alt="Logo" className="h-9 w-9 rounded-lg" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            排期画布 · 团队日程
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            查看团队排期、项目任务和空闲时段
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4"
        >
          <div>
            <FieldLabel required>登录账号</FieldLabel>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入登录账号"
                autoComplete="username"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-700">
                登录密码<span className="text-red-500 ml-0.5">*</span>
              </label>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                忘记密码？
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
                className="pl-9"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isLoading || submitting}
            className="w-full mt-2"
          >
            <span>进入工作台</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <ModalDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        title="找回 / 重置密码"
        description="输入登录账号与绑定邮箱，验证通过后可直接设置新密码。"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleForgotSubmit} className="space-y-3.5">
          <div>
            <FieldLabel required>登录账号</FieldLabel>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={fpUsername}
                onChange={(e) => setFpUsername(e.target.value)}
                placeholder="例如：zhangsan"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <FieldLabel required>绑定邮箱</FieldLabel>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="email"
                value={fpEmail}
                onChange={(e) => setFpEmail(e.target.value)}
                placeholder="例如：zhangsan@company.com"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <FieldLabel required>新密码（至少 6 位）</FieldLabel>
            <Input
              type="password"
              value={fpNewPassword}
              onChange={(e) => setFpNewPassword(e.target.value)}
              placeholder="输入新密码"
            />
          </div>
          <div>
            <FieldLabel required>确认新密码</FieldLabel>
            <Input
              type="password"
              value={fpConfirm}
              onChange={(e) => setFpConfirm(e.target.value)}
              placeholder="再次输入新密码"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setForgotOpen(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" loading={fpLoading}>
              确认重置
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
