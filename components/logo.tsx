import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export const Logo = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('font-mono font-semibold group cursor-default', className)}
    style={{ color: 'oklch(0.91 0.18 163)' }}
    {...props}
  >
    <span className="group-hover:hidden"><span className="italic">t</span>think</span>
    <span className="hidden group-hover:inline">
      <span className="italic">t</span><span className="italic">uring</span>think
    </span>
  </div>
);
