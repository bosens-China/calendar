import React, { useState } from 'react';
import { toast } from 'sonner';
import { authApi } from '../../api';
import { useAuthStore } from '../../store/authStore';
import { Button, FieldLabel, Input } from '../ui/primitives';
import { ModalDialog } from '../ui/overlays';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<Props> = ({ open, onClose }) => {
  const { logout } = useAuthStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || newPassword.length < 6) {
      toast.error('请输入当前密码，且新密码不少于 6 位');
      return;
    }
    if (newPassword !== confirm) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({ oldPassword, newPassword });
      toast.success('密码修改成功，请重新登录');
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
      onClose();
      logout();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="修改登录密码"
      maxWidthClass="max-w-sm"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <FieldLabel required>当前密码</FieldLabel>
          <Input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="请输入原密码"
          />
        </div>
        <div>
          <FieldLabel required>新密码（至少 6 位）</FieldLabel>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="请输入新密码"
          />
        </div>
        <div>
          <FieldLabel required>确认新密码</FieldLabel>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="请再次输入新密码"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            确认修改
          </Button>
        </div>
      </form>
    </ModalDialog>
  );
};
