'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createElement, useEffect, useRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { useUi } from '@/lib/store';

gsap.registerPlugin(ScrollTrigger);
const mapRange = (a: number, b: number, v: number, c: number, d: number) => ((v - a) * (d - c)) / (b - a) + c;

/** Scroll-scrubbed parallax (port of MotionParallax). Starts after page transitions finish. */
export function MotionParallax({
  tag = 'img',
  offset = 10,
  scale = 1.1,
  className,
  innerClassName,
  children,
}: {
  tag?: string;
  offset?: number;
  scale?: number;
  onMobile?: boolean;
  className?: string;
  innerClassName?: string;
  children?: ReactNode;
}) {
  const item = useRef<HTMLElement>(null);
  const isNavigating = useUi((x) => x.isNavigating);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const el = item.current;
    if (!el || isNavigating) return;
    gsap.set(el, { transformOrigin: '50% 50%', scale, y: '0%', willChange: 'transform' });
    const setY = gsap.quickSetter(el, 'y', '%');
    const setF = gsap.quickSetter(el, 'force3D');
    tl.current = gsap.timeline({
      scrollTrigger: {
        trigger: el.parentNode as Element,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        onUpdate: (t) => {
          setY(mapRange(0, 1, t.progress, -offset, offset));
          setF(t.progress > 0 && t.progress < 1);
        },
      },
    });
    return () => {
      tl.current?.scrollTrigger?.kill();
      tl.current?.kill();
      tl.current = null;
    };
  }, [isNavigating, offset, scale]);

  return (
    <div className={cx('flex items-start justify-center overflow-hidden', className)}>
      {createElement(tag, { ref: item, className: cx('h-fit', innerClassName) }, children)}
    </div>
  );
}
