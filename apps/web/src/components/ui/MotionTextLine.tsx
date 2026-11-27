'use client';

import { createElement, useEffect, useRef, type CSSProperties } from 'react';
import { cx } from '@/lib/cx';
import { escapeHtml, splitLines } from '@/lib/split';
import { observeAttr, type MotionTextProps } from './MotionTextChar';

/**
 * Line-by-line reveal (port of MotionTextLine).
 * `splitLines` wraps each line in `.line-mask > .line`; lines slide up when the element gets `.is-inview`.
 */
export function MotionTextLine({
  tag = 'span',
  text,
  html,
  observe = true,
  once = true,
  transition = true,
  speed = 1.25,
  stagger = 0.1,
  delay = 0,
  lineHeight = '110%',
  className,
  style,
  ...rest
}: MotionTextProps) {
  const ref = useRef<HTMLElement>(null);
  const content = html ?? escapeHtml(text);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = window.setTimeout(() => splitLines(el, content, delay), 200);
    return () => window.clearTimeout(t);
  }, [content, delay]);

  return createElement(tag, {
    ...rest,
    ref,
    className: cx(
      'invisible leading-(--line-height) inview:visible',
      '[&_.line-mask]:[clip-path:inset(-20%_0_0_0)]',
      '[&_.line]:transform-[translate3d(0,115%,0)]',
      !transition && '[&_.line]:[transition:none]',
      '[&.is-inview_.line]:transform-[translateZ(0)]',
      '[&.is-inview_.line]:[transition:transform_var(--speed)_var(--ease-expo)_calc(var(--index)_*_var(--stagger)_+_var(--delay)_*_var(--speed))]',
      className,
    ),
    style: { '--speed': `${speed}s`, '--stagger': `${stagger}s`, '--line-height': lineHeight, ...style } as CSSProperties,
    'data-observe': once ? 'once' : observe ? 'true' : undefined,
    'aria-label': (text ?? content.replace(/<[^>]+>/g, '')).replaceAll('\n', ' '),
    dangerouslySetInnerHTML: { __html: content },
    suppressHydrationWarning: true,
  });
}

export { observeAttr };
