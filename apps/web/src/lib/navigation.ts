'use client';

import { bus } from './bus';
import { lenis } from './lenis';
import { refreshObserver } from './observer';
import { ui } from './store';

/**
 * Page transition choreography — ported from the original router hooks:
 *  before: stop scroll → (unless the menu is open) cover the page with the intro panel → wait 1 s → navigate
 *  after:  wait 0.5 s (0.15 s from the menu) → resume scroll → reveal → 0.25 s later end "transitioning"
 */
let pending: string | null = null;
let transitionsEnabled = true;

export function setTransitionsEnabled(v: boolean) {
  transitionsEnabled = v;
}

export function beforeNavigate(href: string, push: (href: string) => void) {
  const s = ui();
  if (s.isNavigating || pending) return;
  pending = href;
  lenis.stop();
  if (!s.isFirstLoad) s.set({ isMenuCollapsed: false });
  const fromMenu = s.isMenuOpen;
  const animate = transitionsEnabled && !fromMenu && !s.isFirstLoad;
  if (animate) s.set({ isNavigating: true });
  window.setTimeout(
    () => {
      ui().set({ isTransitioning: true });
      push(href);
    },
    animate ? 1000 : 0,
  );
}

/** Called by the shell when the rendered pathname changed. */
export function afterNavigate() {
  const s = ui();
  pending = null;
  lenis.scrollTo(0, { immediate: true });
  refreshObserver(100);
  bus.emit('routeChanged');
  if (s.isFirstLoad) return;
  const fromMenu = s.isMenuOpen;
  window.setTimeout(
    () => {
      lenis.start();
      if (fromMenu) ui().set({ isClosingMenu: true });
      if (ui().isNavigating) ui().set({ isNavigating: false });
      window.setTimeout(() => ui().set({ isTransitioning: false }), 250);
    },
    fromMenu ? 150 : 500,
  );
}
