import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '../../lib/utils';

export const Avatar = ({ className, ...props }) => <AvatarPrimitive.Root className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-background', className)} {...props} />;
export const AvatarImage = ({ className, ...props }) => <AvatarPrimitive.Image className={cn('aspect-square size-full object-cover', className)} {...props} />;
export const AvatarFallback = ({ className, ...props }) => <AvatarPrimitive.Fallback className={cn('flex size-full items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground', className)} {...props} />;
