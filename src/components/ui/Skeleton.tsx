import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden="true" className="grid gap-3">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')}
          key={index}
        />
      ))}
    </div>
  );
}
