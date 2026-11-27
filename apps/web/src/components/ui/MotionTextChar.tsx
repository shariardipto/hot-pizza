'use client';

import { createElement, useEffect, useRef, type CSSProperties, type HTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import { escapeHtml, splitChars } from '@/lib/split';

export interface MotionTextProps extends Omit<HTMLAttributes<HTMLElement>, 'dangerouslySetInnerHTML'> {
  tag?: string;
  /** Plain text (escaped). */
  text?: string | null;
  /** Trusted HTML (e.g. from `mdInline`). Takes precedence over `text`. */
  html?: string | null;
  observe?: boolean;
  once?: boolean;
  transition?: boolean;
  speed?: number;
  stagger?: number;
  delay?: number;
  lineHeight?: string;
}

export function observeAttr(observe: boolean, once: boolean) {
  return once && observe ? 'once' : observe ? 'true' : undefined;
}

/**
 * Character-by-character reveal (port of MotionTextChar).
 * `splitChars` wraps each character in `.char-mask > .char`; characters slide up when the element gets `.is-inview`.
 */
export function MotionTextChar({
  tag = 'div',
  text,
  html,
  observe = true,
  once = true,
  transition = true,
  speed = 1.25,
  stagger = 0.025,
  delay = 0,
  lineHeight,
  className,
  style,
  ...rest
}: MotionTextProps) {
  const ref = useRef<HTMLElement>(null);
  const content = html ?? escapeHtml(text);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = window.setTimeout(() => splitChars(el, content, delay), 200);
    return () => window.clearTimeout(t);
  }, [content, delay]);

  return createElement(tag, {
    ...rest,
    ref,
    className: cx(
      'invisible inview:visible',
      '[&_.char-mask]:[clip-path:inset(-20%_-20%_-10%_-20%)]',
      '[&_.char]:will-change-transform [&_.char]:transform-[translate3d(0,115%,0)]',
      !transition && 'visible [&_.char]:[transition:none]',
      '[&.is-inview_.char]:transform-[translateZ(0)]',
      '[&.is-inview_.char]:[transition:transform_var(--speed)_var(--ease-expo)_calc(var(--index)_*_var(--stagger)_+_var(--delay)_*_var(--speed))]',
      '[&_em]:tracking-[0]',
      className,
    ),
    style: { '--speed': `${speed}s`, '--stagger': `${stagger}s`, ...style } as CSSProperties,
    'data-observe': observeAttr(observe, once),
    'aria-label': (text ?? content.replace(/<[^>]+>/g, '')).replaceAll('\n', ' '),
    ...(lineHeight ? { lineheight: lineHeight } : {}),
    dangerouslySetInnerHTML: { __html: content },
    suppressHydrationWarning: true,
  });
}
