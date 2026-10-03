import { cn } from '../../lib/utils';

export function Input({ className, type = 'text', ...props }) {
  return <input type={type} className={cn('flex h-10 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm shadow-sm shadow-black/[0.02] transition placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}
