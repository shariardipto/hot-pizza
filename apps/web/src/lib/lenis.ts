'use client';

import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

type ScrollHandler = (e: { scroll: number; limit: number; velocity: number; direction: number; progress: number }) => void;

/**
 * Smooth scroll engine — same settings as the original (duration 1.2, expo-out easing).
 * When smooth scroll is disabled in the theme (or the user prefers reduced motion) a native-scroll shim is used.
 */
class SmoothScroll {
  core: Lenis | null = null;
  private stopped = false;
  private listeners = new Set<ScrollHandler>();
  private rafId = 0;
  private nativeHandler: (() => void) | null = null;

  init(opts: { enabled: boolean; duration: number }) {
    if (this.core || this.nativeHandler) return;
    if (opts.enabled) {
      this.core = new Lenis({
        duration: opts.duration,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        infinite: false,
      });
      this.core.on('scroll', (e: any) => {
        ScrollTrigger.update();
        this.listeners.forEach((fn) => fn(e));
      });
      const raf = (time: number) => {
        this.core?.raf(time);
        this.rafId = requestAnimationFrame(raf);
      };
      this.rafId = requestAnimationFrame(raf);
    } else {
      this.nativeHandler = () => {
        const limit = document.documentElement.scrollHeight - window.innerHeight;
        this.listeners.forEach((fn) => fn({ scroll: window.scrollY, limit, velocity: 0, direction: 0, progress: limit ? window.scrollY / limit : 0 }));
      };
      window.addEventListener('scroll', this.nativeHandler, { passive: true });
    }
    gsap.config({ nullTargetWarn: false });
    this.setClass();
  }

  on(_event: 'scroll', fn: ScrollHandler) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  get scroll() {
    return this.core ? this.core.scroll : window.scrollY;
  }

  start() {
    this.stopped = false;
    this.core?.start();
    if (!this.core) document.documentElement.style.overflow = '';
    this.setClass();
  }

  stop() {
    this.stopped = true;
    this.core?.stop();
    if (!this.core) document.documentElement.style.overflow = 'hidden';
    this.setClass();
  }

  scrollTo(target: number | string | HTMLElement, opts: { immediate?: boolean; offset?: number; duration?: number } = {}) {
    if (this.core) this.core.scrollTo(target as any, { ...opts, force: true });
    else if (typeof target === 'number') window.scrollTo({ top: target, behavior: opts.immediate ? 'auto' : 'smooth' });
    else (typeof target === 'string' ? document.querySelector(target) : target)?.scrollIntoView({ behavior: opts.immediate ? 'auto' : 'smooth' });
  }

  resize() {
    this.core?.resize();
    ScrollTrigger.refresh();
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.core?.destroy();
    this.core = null;
    if (this.nativeHandler) window.removeEventListener('scroll', this.nativeHandler);
    this.nativeHandler = null;
  }

  private setClass() {
    document.documentElement.classList.toggle('lenis-active', !this.stopped && Boolean(this.core));
  }
}

export const lenis = new SmoothScroll();
