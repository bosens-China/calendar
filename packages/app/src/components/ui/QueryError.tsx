import { Button } from './primitives';

export function QueryError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="flex w-full flex-wrap items-center justify-center gap-3 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
      <span>{message}</span>
      <Button size="xs" variant="outline" onClick={retry}>重试</Button>
    </div>
  );
}
