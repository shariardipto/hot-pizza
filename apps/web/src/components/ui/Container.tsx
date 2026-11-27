import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';

/** Centered content column (`--width` of the layout grid). `full` = full width, `flex` = flex container. */
export function Container({ full, flex, className, children }: { full?: boolean; flex?: boolean; className?: string; children?: ReactNode }) {
  return <div className={cx('relative mx-auto my-0', full ? 'w-full' : 'w-width', flex && 'flex', className)}>{children}</div>;
}
