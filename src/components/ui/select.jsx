import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;
export function SelectTrigger({ className, size = 'default', children, ...props }) {
  return <SelectPrimitive.Trigger className={cn('flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-background px-3.5 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50', size === 'default' ? 'h-10' : 'h-9', className)} {...props}>{children}<SelectPrimitive.Icon><ChevronDown size={15} className="text-muted-foreground" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>;
}
export function SelectContent({ className, children, position = 'popper', ...props }) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content position={position} className={cn('z-50 max-h-80 min-w-32 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl shadow-black/10', className)} {...props}><SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1"><ChevronUp size={14} /></SelectPrimitive.ScrollUpButton><SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport><SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1"><ChevronDown size={14} /></SelectPrimitive.ScrollDownButton></SelectPrimitive.Content></SelectPrimitive.Portal>;
}
export function SelectItem({ className, children, ...props }) {
  return <SelectPrimitive.Item className={cn('relative flex w-full cursor-default select-none items-center rounded-lg py-2 pl-8 pr-2.5 text-sm outline-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-40', className)} {...props}><span className="absolute left-2 grid size-4 place-items-center"><SelectPrimitive.ItemIndicator><Check size={13} /></SelectPrimitive.ItemIndicator></span><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>;
}
export function SelectLabel({ className, ...props }) { return <SelectPrimitive.Label className={cn('px-2.5 py-2 text-xs font-semibold text-muted-foreground', className)} {...props} />; }
export function SelectSeparator({ className, ...props }) { return <SelectPrimitive.Separator className={cn('mx-1 my-1 h-px bg-border', className)} {...props} />; }
