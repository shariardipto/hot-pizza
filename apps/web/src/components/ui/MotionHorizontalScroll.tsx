'use client';

import { gsap } from 'gsap';
import { useEffect, useRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { useUi } from '@/lib/store';

/** Mouse-position driven horizontal scroller (desktop); native snap scroll below 1280px via CSS. */
class HorizontalScroll {
  currentX = 0;
  targetX = 0;
  isAnimating = false;
  rafId = 0;
  wrapperWidth = 0;
  maxScrollWidth = 0;
  quickSetter: (v: number) => void;
  private onEnter = () => this.start();
  private onLeave = () => this.stop();
  private onMove = (e: MouseEvent) => {
    this.targetX = this.maxScrollWidth * (e.clientX / window.innerWidth);
  };
  private onResize = () => {
    this.updateDimensions();
    this.quickSetter(-this.currentX);
  };

  constructor(
    private el: HTMLElement,
    private fromCenter = false,
  ) {
    this.updateDimensions();
    this.quickSetter = gsap.quickSetter(el, 'x', 'px') as (v: number) => void;
  }
  init() {
    this.el.addEventListener('mouseenter', this.onEnter);
    this.el.addEventListener('mouseleave', this.onLeave);
    window.addEventListener('resize', this.onResize);
    if (this.fromCenter) {
      this.currentX = this.maxScrollWidth / 2;
      this.targetX = this.currentX;
      this.quickSetter(-this.targetX);
    }
  }
  updateDimensions() {
    const st = getComputedStyle(this.el);
    this.wrapperWidth = window.innerWidth;
    this.maxScrollWidth = this.el.scrollWidth - this.wrapperWidth + (parseFloat(st.paddingRight) - parseFloat(st.paddingLeft));
  }
  start() {
    window.addEventListener('mousemove', this.onMove);
    this.isAnimating = true;
    this.animate();
  }
  animate = () => {
    if (this.isAnimating || Math.abs(this.currentX - this.targetX) > 1) {
      this.currentX = (1 - 0.065) * this.currentX + 0.065 * this.targetX;
      this.quickSetter(-this.currentX);
      this.rafId = requestAnimationFrame(this.animate);
    } else cancelAnimationFrame(this.rafId);
  };
  stop() {
    gsap.delayedCall(0.25, () => {
      window.removeEventListener('mousemove', this.onMove);
      this.isAnimating = false;
      cancelAnimationFrame(this.rafId);
      this.quickSetter(-this.currentX);
    });
  }
  destroy() {
    this.el.removeEventListener('mouseenter', this.onEnter);
    this.el.removeEventListener('mouseleave', this.onLeave);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('resize', this.onResize);
    this.isAnimating = false;
    cancelAnimationFrame(this.rafId);
    this.quickSetter(0);
  }
}

export function MotionHorizontalScroll({ fromCenter = false, className, children }: { fromCenter?: boolean; className?: string; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useUi((x) => x.isMobile);
  const isTablet = useUi((x) => x.isTablet);

  useEffect(() => {
    if (!ref.current || isMobile || isTablet) return;
    const hs = new HorizontalScroll(ref.current, fromCenter);
    hs.init();
    return () => hs.destroy();
  }, [isMobile, isTablet, fromCenter]);

  return (
    <div className={cx('flex w-screen overflow-hidden', fromCenter && 'items-center', className)}>
      {/* Below 1280px: native horizontal scroll with snapping (the mouse-driven scroll is desktop only). */}
      <div
        ref={ref}
        className={cx(
          'grid grid-flow-col gap-gutter px-offset',
          'max-lg:snap-x max-lg:snap-mandatory max-lg:scroll-px-offset max-lg:overflow-x-auto max-lg:whitespace-nowrap max-lg:*:snap-start max-lg:[&::-webkit-scrollbar]:hidden',
        )}
      >
        {children}
      </div>
    </div>
  );
}
