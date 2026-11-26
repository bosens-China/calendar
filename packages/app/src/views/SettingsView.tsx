import { LOCAL_MODE } from '../api';
import { useAuthStore } from '../store/authStore';
import { Tabs } from '../components/ui/overlays';
import { HolidaySettings } from '../components/settings/HolidaySettings';
import { WorkSlotsSettings } from '../components/settings/WorkSlotsSettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { ResetSettings } from '../components/settings/ResetSettings';
import { RoleSettings } from '../components/settings/RoleSettings';

const tabs = [
  ['slots', '工作时段'],
  ['holidays', '法定节假日与调休'],
  ['profile', '个人资料'],
  ['roles', '角色显示名称'],
  ['reset', '重置'],
] as const;

export function SettingsView() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const canEditRoles = !LOCAL_MODE && isAdmin;
  return (
    <Tabs.Root defaultValue="slots" className="space-y-4">
      <Tabs.List className="flex flex-wrap gap-1 rounded-lg bg-zinc-100 p-1 text-xs dark:bg-zinc-900" aria-label="设置类别">
        {tabs.filter(([key]) => key !== 'roles' || canEditRoles).map(([key, label]) => (
          <Tabs.Trigger key={key} value={key}
            className="cursor-pointer rounded-md px-3 py-1.5 font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-800"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="slots"><WorkSlotsSettings isAdmin={isAdmin} /></Tabs.Content>
      <Tabs.Content value="holidays"><HolidaySettings isAdmin={isAdmin} /></Tabs.Content>
      <Tabs.Content value="profile">{user && <ProfileSettings user={user} />}</Tabs.Content>
      {canEditRoles && <Tabs.Content value="roles"><RoleSettings /></Tabs.Content>}
      <Tabs.Content value="reset"><ResetSettings isAdmin={isAdmin} /></Tabs.Content>
    </Tabs.Root>
  );
}
