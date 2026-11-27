'use client';

import { createElement, type CSSProperties } from 'react';
import { cx } from '@/lib/cx';
import { mdInline } from '@/lib/split';
import { useUi } from '@/lib/store';
import { MotionTextChar } from './MotionTextChar';

/** First line: small caption | big word | small caption (captions hidden on phones). */
const firstLine = 'grid items-center justify-center gap-gutter-half md:grid-cols-[max(10rem,min(10vw,20rem))_auto_max(10rem,min(10vw,20rem))] md:gap-gutter';

/** Huge multi-line title with optional small captions left/right of the first line (port of TitleLarge). */
export function TitleLarge({
  title = 'Our\nTraditional\nProducts',
  titleSmallLeft = 'A New\nTradition',
  titleSmallRight = 'Spanish\nCulinary',
  tag = 'h3',
  large = false,
  small = false,
  className,
  style,
}: {
  title?: string | null;
  titleSmallLeft?: string | null;
  titleSmallRight?: string | null;
  tag?: string;
  large?: boolean;
  small?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const isMobile = useUi((x) => x.isMobile);
  const lines = (title ?? '').split('\n');
  return createElement(
    tag,
    { className: cx('text-center', { 'text-300': large && !small, 'text-260': !large && !small, 'text-110': small }, className), style },
    lines.map((line, i) => (
      <span key={i} className={cx('uppercase', i === 0 && firstLine)} aria-hidden="true">
        {i === 0 && !titleSmallLeft ? <span /> : null}
        {i === 0 && titleSmallLeft ? (
          <MotionTextChar
            className={cx('block justify-end', large ? 'text-35' : 'text-base')}
            style={isMobile ? { display: 'none' } : undefined}
            aria-hidden="true"
            lineHeight="120%"
            html={mdInline(titleSmallLeft)}
          />
        ) : null}
        <MotionTextChar lineHeight="70%" delay={i} text={line} aria-hidden="true" />
        {i === 0 && titleSmallRight ? (
          <MotionTextChar
            className={cx('block', large ? 'text-35' : 'text-base')}
            style={isMobile ? { display: 'none' } : undefined}
            aria-hidden="true"
            lineHeight="120%"
            html={mdInline(titleSmallRight)}
          />
        ) : null}
      </span>
    )),
  );
}
