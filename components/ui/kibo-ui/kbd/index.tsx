import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ComponentProps, forwardRef } from 'react';

const kbdVariants = cva(
  'inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground shadow-sm',
  {
    variants: {
      size: {
        sm: 'h-5 min-w-5 text-[10px] px-1',
        default: 'h-6 min-w-6 text-xs px-1.5',
        lg: 'h-7 min-w-7 text-sm px-2',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
);

export interface KbdProps
  extends ComponentProps<'kbd'>,
    VariantProps<typeof kbdVariants> {}

export const Kbd = forwardRef<HTMLElement, KbdProps>(
  ({ className, size, ...props }, ref) => (
    <kbd
      ref={ref}
      className={cn(kbdVariants({ size }), className)}
      {...props}
    />
  )
);

Kbd.displayName = 'Kbd';