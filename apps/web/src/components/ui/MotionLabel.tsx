import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';
import { MotionTextChar } from './MotionTextChar';

/** Animated link label: characters reveal in view, text rolls on hover (port of MotionLink). */
export function MotionLabel({ text, color = 'var(--c-secondary)', delay = 0, className, style }: { text: string | null | undefined; color?: string; delay?: number; className?: string; style?: CSSProperties }) {
  return (
    <div className={cx('group/label relative pb-2 [clip-path:inset(0_0_-8%_0)]', className)} style={{ '--color': color, ...style } as CSSProperties}>
      <div
        className={cx(
          'relative flex [transition:transform_1s_var(--ease-expo)] pointer-fine:group-hover/label:transform-[translate3d(0,-110%,0)]',
          'after:absolute after:top-[110%] after:left-0 after:content-[attr(data-label)]',
        )}
        data-label={text ?? ''}
      >
        <MotionTextChar text={text} delay={delay} />
      </div>
    </div>
  );
}
