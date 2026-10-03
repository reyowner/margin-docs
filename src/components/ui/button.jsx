import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const variants = cva('inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      outline: 'border border-border bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground',
      ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
      destructive: 'bg-destructive text-white hover:bg-destructive/90',
      link: 'text-primary underline-offset-4 hover:underline',
    },
    size: {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 rounded-lg px-3 text-xs',
      lg: 'h-12 rounded-xl px-5',
      icon: 'size-9',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export function Button({ className, variant, size, type = 'button', ...props }) {
  return <button type={type} className={cn(variants({ variant, size }), className)} {...props} />;
}
