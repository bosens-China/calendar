import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'xs' | 'sm' | 'md' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:border-zinc-100 dark:hover:bg-zinc-200',
  secondary:
    'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-transparent dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
  outline:
    'bg-white text-zinc-700 hover:bg-zinc-50 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-800 dark:hover:bg-zinc-800/80',
  ghost:
    'bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs rounded-md gap-1',
  sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  icon: 'h-8 w-8 p-0 rounded-lg justify-center',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'outline',
  size = 'sm',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50',
      'disabled:opacity-45 disabled:pointer-events-none',
      BUTTON_VARIANTS[variant],
      BUTTON_SIZES[size],
      className,
    )}
    {...rest}
  >
    {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
    {children}
  </button>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className,
  ...rest
}) => (
  <input
    className={cn(
      'w-full h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400',
      'transition-colors focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200',
      'disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
      'dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800 dark:disabled:bg-zinc-900',
      className,
    )}
    {...rest}
  />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className,
  ...rest
}) => (
  <textarea
    className={cn(
      'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400',
      'transition-colors focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200',
      'dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800',
      className,
    )}
    {...rest}
  />
);

export const SelectField: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className,
  children,
  ...rest
}) => (
  <select
    className={cn(
      'w-full h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-900',
      'transition-colors focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200',
      'disabled:bg-zinc-50 disabled:text-zinc-500 disabled:cursor-not-allowed',
      'dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:ring-zinc-800 dark:disabled:bg-zinc-900',
      className,
    )}
    {...rest}
  >
    {children}
  </select>
);

export const FieldLabel: React.FC<{
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}> = ({ children, required, className }) => (
  <label className={cn('block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5', className)}>
    {children}
    {required && <span className="text-rose-500 ml-0.5">*</span>}
  </label>
);

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'purple';
  className?: string;
}> = ({ children, tone = 'neutral', className }) => {
  const tones: Record<string, string> = {
    neutral:
      'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    blue:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
    green:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    amber:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    red:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
    purple:
      'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
};

export const Spinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-2.5 text-zinc-500 dark:text-zinc-400">
    <Loader2 className="h-6 w-6 animate-spin text-zinc-800 dark:text-zinc-200" />
    {label && <span className="text-xs">{label}</span>}
  </div>
);
