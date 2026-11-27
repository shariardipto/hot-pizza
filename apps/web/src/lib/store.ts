'use client';

import { create } from 'zustand';

/** UI state shared by the animated shell (port of the original Vuex store). */
export interface UiState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isReady: boolean;
  isFirstLoad: boolean;
  isMenuOpen: boolean;
  isClosingMenu: boolean;
  isMenuCollapsed: boolean;
  isTransitioning: boolean;
  isNavigating: boolean;
  isCartOpen: boolean;
  set: (patch: Partial<Omit<UiState, 'set'>>) => void;
}

export const useUi = create<UiState>((set) => ({
  isMobile: false,
  isTablet: false,
  isDesktop: false,
  isTouch: false,
  isReady: false,
  isFirstLoad: true,
  isMenuOpen: false,
  isClosingMenu: false,
  isMenuCollapsed: false,
  isTransitioning: false,
  isNavigating: false,
  isCartOpen: false,
  set: (patch) => set(patch),
}));

export const ui = () => useUi.getState();

export function checkDevice() {
  const w = window.matchMedia;
  const isTouch = 'ontouchstart' in window || w('(pointer: coarse)').matches;
  useUi.getState().set({
    isMobile: w('(max-width: 959px)').matches,
    isTablet: w('(min-width: 960px) and (max-width: 1279px)').matches,
    isDesktop: w('(min-width: 1280px)').matches,
    isTouch,
  });
}
