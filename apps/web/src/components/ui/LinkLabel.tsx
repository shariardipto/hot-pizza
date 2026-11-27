import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';

/**
 * Text with the rolling hover + underline effect (port of the original `Link` component).
 * The label rolls up on hover (desktop); the underline (::after) is shown for the current page (`nuxt-link-exact-active`, set by TLink).
 */
export function LinkLabel({
  text,
  // --link-color is set by the top navigation and the menu (their own colors); secondary everywhere else.
  color = 'var(--link-color, var(--c-secondary))',
  underline = true,
  className,
}: {
  text: string | null | undefined;
  color?: string;
  underline?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'group/link relative pb-2 [clip-path:inset(-10%_0_0_0)]',
        underline && [
          "after:absolute after:left-0 after:flex after:h-[2px] after:w-full after:bg-(--color) after:content-['']",
          'after:transform-[scaleX(0)] after:[transition:transform_1s_var(--ease-expo)]',
          '[.nuxt-link-exact-active_&]:after:transform-[scaleX(1)]',
        ],
        className,
      )}
      style={{ '--color': color } as CSSProperties}
    >
      <span
        className={cx(
          'relative flex [transition:transform_1s_var(--ease-expo)] pointer-fine:group-hover/link:transform-[translate3d(0,-120%,0)]',
          'after:absolute after:top-[120%] after:left-0 after:content-[attr(data-label)]',
        )}
        data-label={text ?? ''}
      >
        {text}
      </span>
    </div>
  );
}
