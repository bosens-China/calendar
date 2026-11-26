import type { Member, Project } from '@calendar/shared';
import { formatHours } from '@calendar/shared';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users2,
} from 'lucide-react';
import { LOCAL_MODE } from '../../api';
import { useRoleLabels } from '../../hooks/useRoleLabels';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useUiStore } from '../../store/uiStore';
import { canNavigatePrev } from '../../utils/date';
import { Button, cn } from '../ui/primitives';
import { DropdownItem, DropdownSeparator, UserDropdown } from '../ui/overlays';
import { PeriodPicker } from './PeriodPicker';
import { WorkbenchFilter } from './WorkbenchFilter';

interface Props {
  activeProjects: Project[];
  activeMembers: Member[];
  selectedProjectIds: string[];
  selectedMemberIds: string[];
  membersWithGap: number;
  totalGapMinutes: number;
  hasData: boolean;
  openCreate: () => void;
  openReview: () => void;
  openProjects: () => void;
  openMembers: () => void;
  openSettings: () => void;
  openPassword: () => void;
}

export function WorkbenchToolbar({
  activeProjects, activeMembers, selectedProjectIds, selectedMemberIds, membersWithGap, totalGapMinutes,
  hasData, openCreate, openReview, openProjects, openMembers, openSettings, openPassword,
}: Props) {
  const { user, logout } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { labels } = useRoleLabels();
  const { theme, setTheme } = useThemeStore();
  const {
    calendarPeriod, currentDate, setSelectedMemberIds, onlyGap, setCalendarPeriod,
    setCurrentDate, setSelectedProjectIds, setOnlyGap, prevPeriod, nextPeriod,
  } = useUiStore();

  const avatarChar = (user?.name || user?.username || 'U').slice(0, 1).toUpperCase();

  return (
    <header className="z-50 flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 py-1.5 border-b border-zinc-200/75 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 px-5">
      {/* Left: Logo + Week/Month Switch + Calendar Picker + Prev/Next */}
      <div className="flex flex-wrap items-center gap-2">
        <img src={import.meta.env.BASE_URL + 'favicon.svg'} alt="Logo" className="h-7 w-7 rounded-lg" />

        <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-900 p-0.5 text-xs">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={calendarPeriod === p}
              onClick={() => { void setCalendarPeriod(p); }}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer',
                calendarPeriod === p
                  ? 'bg-white text-zinc-950 shadow-2xs dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
              )}
            >
              {p === 'week' ? '周' : '月'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            disabled={!canNavigatePrev(currentDate, calendarPeriod)}
            onClick={prevPeriod}
            title="上一周期"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <PeriodPicker
            period={calendarPeriod}
            currentDate={currentDate}
            onChangeDate={setCurrentDate}
          />

          <Button size="icon" variant="ghost" onClick={nextPeriod} title="下一周期">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Right: Project Filter + Gap Indicator + Review + Theme Toggle + New + Avatar */}
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin && (
          <WorkbenchFilter label="成员" options={activeMembers}
            selectedIds={selectedMemberIds} onChange={setSelectedMemberIds}
          />
        )}
        <WorkbenchFilter label="项目" options={activeProjects}
          selectedIds={selectedProjectIds} onChange={setSelectedProjectIds}
        >
          {isAdmin && (
            <button
              type="button"
              onClick={openProjects}
              className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-200 py-1.5 text-xs font-medium text-zinc-500 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <Plus className="h-3.5 w-3.5" />
              管理项目
            </button>
          )}
        </WorkbenchFilter>

        <Button
          variant={onlyGap ? 'primary' : 'outline'}
          disabled={!hasData}
          aria-pressed={onlyGap}
          onClick={() => setOnlyGap(!onlyGap)}
          title={membersWithGap > 0 ? `${membersWithGap} 人空档 · ${formatHours(totalGapMinutes)}` : undefined}
        >
          <Search className="h-3.5 w-3.5" />
          检查空闲
          {membersWithGap > 0 && (
            <span className={cn(
              'rounded px-1 text-[10px]',
              onlyGap ? 'bg-white/15 dark:bg-black/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
            )}>
              {membersWithGap}
            </span>
          )}
        </Button>

        <Button size="sm" variant="ghost" onClick={openReview}>
          <BarChart3 className="h-3.5 w-3.5" />
          复盘
        </Button>

        <Button size="sm" variant="primary" disabled={!hasData} onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          {isAdmin ? '新建' : '请假'}
        </Button>

        <UserDropdown
          trigger={
            <button
              type="button"
              aria-label="账户菜单"
              className="ml-0.5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white transition-transform hover:scale-105 cursor-pointer"
              style={{ backgroundColor: user?.avatarColor || '#18181b' }}
            >
              {avatarChar}
            </button>
          }
        >
          <div className="px-2.5 py-2">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {user?.name}
            </div>
            <div className="text-[11px] text-zinc-400">
              {LOCAL_MODE ? '个人版' : `团队版 · ${user && labels[user.role]} · @${user?.username}`}
            </div>
          </div>
          <DropdownSeparator />
          <div className="px-2 py-1.5">
            <div className="mb-1.5 px-0.5 text-[10px] font-medium text-zinc-400">外观主题</div>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5">
              {(
                [
                  { key: 'auto', label: '自动', icon: Monitor },
                  { key: 'light', label: '浅色', icon: Sun },
                  { key: 'dark', label: '深色', icon: Moon },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  className={cn(
                    'inline-flex items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors cursor-pointer',
                    theme === key
                      ? 'bg-white text-zinc-900 shadow-2xs dark:bg-zinc-700 dark:text-zinc-50'
                      : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <DropdownSeparator />
          {isAdmin && (
            <>
              <DropdownItem onClick={openProjects}>
                <FolderKanban className="h-3.5 w-3.5" />
                项目管理
              </DropdownItem>
              <DropdownItem onClick={openMembers}>
                <Users2 className="h-3.5 w-3.5" />
                {LOCAL_MODE ? '排期人员' : '人员管理'}
              </DropdownItem>
            </>
          )}
          <DropdownItem onClick={openSettings}>
            <Settings className="h-3.5 w-3.5" />
            系统设置
          </DropdownItem>
          {!LOCAL_MODE && (
            <>
              <DropdownSeparator />
              <DropdownItem onClick={openPassword}>
                <KeyRound className="h-3.5 w-3.5" />
                修改密码
              </DropdownItem>
              <DropdownItem danger onClick={() => {
                if (window.confirm('确定退出登录？')) logout();
              }}>
                <LogOut className="h-3.5 w-3.5" />
                退出登录
              </DropdownItem>
            </>
          )}
        </UserDropdown>
      </div>
    </header>
  );
}
