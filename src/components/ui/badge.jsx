import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.01em] transition-colors', {
  variants: { variant: {
    default: 'border-transparent bg-primary/10 text-primary',
    secondary: 'border-transparent bg-secondary text-secondary-foreground',
    outline: 'border-border text-muted-foreground',
    success: 'border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  } }, defaultVariants: { variant: 'default' },
});
export function Badge({ className, variant, ...props }) { return <span className={cn(badgeVariants({ variant }), className)} {...props} />; }
