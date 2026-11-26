import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { PopoverCard } from '../ui/overlays';
import { Button } from '../ui/primitives';

interface Props {
  label: '成员' | '项目';
  options: { id: string; name: string; color?: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  children?: ReactNode;
}

export function WorkbenchFilter({ label, options, selectedIds, onChange, children }: Props) {
  const allLabel = `全部${label}`;
  const selectedLabel = `已选 ${selectedIds.length} 个${label}`;
  const buttonLabel = selectedIds.length === 0
    ? allLabel
    : selectedIds.length === 1
      ? options.find(option => option.id === selectedIds[0])?.name ?? selectedLabel
      : selectedLabel;

  return (
    <PopoverCard
      side="bottom"
      align="end"
      trigger={
        <Button variant={selectedIds.length ? 'primary' : 'outline'}>
          <span className="max-w-28 truncate">{buttonLabel}</span>
          <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      }
    >
      <div className="w-52 space-y-1">
        <button
          type="button"
          aria-pressed={selectedIds.length === 0}
          onClick={() => onChange([])}
          className="w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 aria-pressed:bg-zinc-100 hover:bg-zinc-100 dark:text-zinc-200 dark:aria-pressed:bg-zinc-800 dark:hover:bg-zinc-800"
        >
          {allLabel}
        </button>
        <div role="group" aria-label={`按${label}筛选`} className="max-h-64 overflow-y-auto border-t border-zinc-100 pt-1 dark:border-zinc-800">
          {options.map(({ id, name, color }) => {
            const checked = selectedIds.includes(id);
            return (
              <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onChange(checked ? selectedIds.filter(value => value !== id) : [...selectedIds, id])}
                  className="shrink-0 accent-zinc-800 dark:accent-zinc-200"
                />
                {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
                <span className="truncate" title={name}>{name}</span>
              </label>
            );
          })}
        </div>
        {children}
      </div>
    </PopoverCard>
  );
}
