import React from 'react';
import { ProjectsView } from '../../views/ProjectsView';
import { MembersView } from '../../views/MembersView';
import { SettingsView } from '../../views/SettingsView';
import { LOCAL_MODE } from '../../api';
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
    title={LOCAL_MODE ? '排期人员' : '人员管理'}
    description={LOCAL_MODE ? "添加需要排期的成员，无需创建登录账号。" : "邀请成员加入团队，分配权限角色。"}
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
