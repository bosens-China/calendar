import React from 'react';
import { ProjectsView } from '../../views/ProjectsView';
import { MembersView } from '../../views/MembersView';
import { SettingsView } from '../../views/SettingsView';
import { ModalDialog, SideSheet } from '../ui/overlays';

export const ProjectsModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => (
  <ModalDialog
    open={open}
    onOpenChange={(v) => !v && onClose()}
    title="项目管理"
    description="多项目扁平展示，支持自定义配色与归档。"
    maxWidthClass="max-w-3xl"
  >
    <ProjectsView />
  </ModalDialog>
);

export const MembersModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => (
  <ModalDialog
    open={open}
    onOpenChange={(v) => !v && onClose()}
    title="人员管理"
    description="创建成员自动分配不重复配色，配置邮箱可支持自助找回密码。"
    maxWidthClass="max-w-4xl"
  >
    <MembersView />
  </ModalDialog>
);

export const SettingsDrawer: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => (
  <SideSheet
    open={open}
    onOpenChange={(v) => !v && onClose()}
    title="系统设置"
    description="配置每日工作时段与 2026+ 中国法定节假日（支持从 GitHub 一键同步）。"
  >
    <SettingsView />
  </SideSheet>
);
