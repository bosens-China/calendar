import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Tabs from '@radix-ui/react-tabs';
import { X } from 'lucide-react';
import { cn } from './primitives';

export const ModalDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: string;
  maxWidthClass?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}> = ({
  open,
  onOpenChange,
  title,
  description,
  maxWidthClass = 'max-w-lg',
  headerExtra,
  children,
}) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]" />
      <Dialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          'rounded-xl border border-zinc-200 bg-white shadow-2xl outline-none',
          'dark:border-zinc-800 dark:bg-zinc-900',
          'flex max-h-[86vh] flex-col',
          maxWidthClass,
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 px-5 py-3.5 shrink-0">
          <div className="min-w-0">
            <Dialog.Title className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {description}
              </Dialog.Description>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerExtra}
            <Dialog.Close className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 text-zinc-900 dark:text-zinc-100">
          {children}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export const SideSheet: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ open, onOpenChange, title, description, children }) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
      <Dialog.Content
        className={cn(
          'fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white shadow-2xl border-l border-zinc-200 outline-none',
          'dark:bg-zinc-950 dark:border-zinc-800',
          'flex flex-col',
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-6 py-4 shrink-0">
          <div>
            <Dialog.Title className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {description}
              </Dialog.Description>
            )}
          </div>
          <Dialog.Close className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer">
            <X className="h-4 w-4" />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 bg-zinc-50/50 dark:bg-zinc-950">
          {children}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export const PopoverCard: React.FC<{
  trigger: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}> = ({ trigger, children, side = 'top', align = 'center' }) => (
  <Popover.Root>
    <Popover.Trigger asChild>{trigger}</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content
        side={side}
        align={align}
        sideOffset={6}
        className="z-50 rounded-xl border border-zinc-200 bg-white p-3 shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
      >
        {children}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
);

export const UserDropdown: React.FC<{
  trigger: React.ReactNode;
  children: React.ReactNode;
}> = ({ trigger, children }) => (
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={8}
        className="z-50 min-w-48 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
);

export const DropdownItem: React.FC<{
  onClick?: () => void;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ onClick, danger, children }) => (
  <DropdownMenu.Item
    onSelect={onClick}
    className={cn(
      'flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium outline-none cursor-pointer transition-colors',
      danger
        ? 'text-rose-600 hover:bg-rose-50 focus:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/15 dark:focus:bg-rose-500/15'
        : 'text-zinc-700 hover:bg-zinc-100 focus:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800',
    )}
  >
    {children}
  </DropdownMenu.Item>
);

export const DropdownSeparator = () => (
  <DropdownMenu.Separator className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
);

export { Tabs };
