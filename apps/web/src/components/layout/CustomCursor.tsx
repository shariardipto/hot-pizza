'use client';

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';
import { bus } from '@/lib/bus';

/** Circle cursor with a label bubble over `[data-cursor-text]` elements (desktop only, via CSS). */
export function CustomCursor() {
  const circle = useRef<HTMLDivElement>(null);
  const labelWrap = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = circle.current!;
    const wrap = labelWrap.current!;
    const lbl = label.current!;
    const show = () => gsap.to(el, { scale: 1, duration: 0.5, ease: 'power4.out' });
    const hide = () => gsap.to(el, { scale: 0, duration: 0.5, ease: 'power4.out' });
    const enter = (e: Event) => {
      hide();
      lbl.innerHTML = (e.currentTarget as HTMLElement).dataset.cursorText ?? '';
      gsap.to(wrap, { scale: 1, duration: 0.5, ease: 'power4.out' });
    };
    const leave = () => {
      show();
      gsap.to(wrap, { scale: 0, duration: 0.5, ease: 'power4.out' });
    };
    const bound = new WeakSet<Element>();
    const getTargets = () => {
      document.querySelectorAll<HTMLElement>('[data-cursor-text]').forEach((t) => {
        if (bound.has(t)) return;
        bound.add(t);
        t.addEventListener('mouseenter', enter);
        t.addEventListener('mouseleave', leave);
      });
    };

    gsap.set(el, { opacity: 0, scale: 0 });
    gsap.set(wrap, { scale: 0 });
    getTargets();
    gsap.to([el], { opacity: 1, scale: 1, duration: 1, ease: 'expo.out', delay: 1 });
    gsap.set(el, { scale: 0.5 });
    const w = el.clientWidth;
    const move = (e: MouseEvent) => {
      gsap.to('html', { attr: { style: `--x: ${e.clientX - w / 2}; --y:${e.clientY - w / 2};` }, duration: 0.4, ease: 'power4' });
    };
    window.addEventListener('mousemove', move);

    // New pages / client-rendered content register their targets.
    const mo = new MutationObserver(() => getTargets());
    mo.observe(document.body, { childList: true, subtree: true });
    const offUpdate = bus.on('updateCursor', getTargets);
    const offReset = bus.on('resetCursor', leave);
    const offRoute = bus.on('routeChanged', () => {
      getTargets();
      leave();
    });
    return () => {
      window.removeEventListener('mousemove', move);
      mo.disconnect();
      offUpdate();
      offReset();
      offRoute();
    };
  }, []);

  return (
    // Desktop only. --x / --y are updated on mouse move.
    <div
      className="pointer-events-none fixed top-0 left-0 z-45 origin-center opacity-100 transform-[translate3d(calc(var(--x)*1px),calc(var(--y)*1px),0)] max-lg:hidden"
      aria-hidden="true"
    >
      <div ref={circle} />
      <div
        ref={labelWrap}
        // Starts at scale(0) in the HTML too: before the script runs it would otherwise show as a white quarter-circle
        // in the top-left corner while the page loads.
        className="absolute top-0 left-0 mx-auto my-0 flex h-100 w-100 items-center justify-center rounded-[10rem] bg-[#fff] whitespace-nowrap will-change-transform transform-[translate3d(-50%,-50%,0)_scale(0)]"
      >
        <div ref={label} className="text-20 text-accent uppercase" aria-hidden="true" />
      </div>
    </div>
  );
}
