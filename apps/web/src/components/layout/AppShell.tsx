'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';
import { CartDrawer } from '@/components/commerce/CartDrawer';
import { useCart } from '@/lib/cart';
import { lenis } from '@/lib/lenis';
import { afterNavigate, setTransitionsEnabled } from '@/lib/navigation';
import { useSite } from '@/lib/site';
import { checkDevice, ui, useUi } from '@/lib/store';
import { CustomCursor } from './CustomCursor';
import { Intro } from './Intro';
import { Menu } from './Menu';
import { MenuLabel } from './MenuLabel';
import { Navbar } from './Navbar';

/** The persistent animated frame around every page (port of the original default layout). */
export function AppShell({ children }: { children: ReactNode }) {
  const { settings } = useSite();
  const motion = settings.theme.motion;
  const isReady = useUi((s) => s.isReady);
  const pathname = usePathname();
  const mounted = useRef(false);

  useEffect(() => {
    const reduced = motion.respectReducedMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    checkDevice();
    const mqs = ['(max-width: 959px)', '(min-width: 960px) and (max-width: 1279px)', '(min-width: 1280px)'].map((q) => window.matchMedia(q));
    const onChange = () => checkDevice();
    mqs.forEach((m) => m.addEventListener('change', onChange));
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    lenis.init({ enabled: motion.smoothScroll && !reduced, duration: motion.smoothScrollDuration });
    setTransitionsEnabled(motion.pageTransitions && !reduced);
    void useCart.persist.rehydrate();
    let t = 0;
    document.fonts.ready.then(() => {
      t = window.setTimeout(() => ui().set({ isReady: true }), 500);
    });
    return () => {
      mqs.forEach((m) => m.removeEventListener('change', onChange));
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      afterNavigate();
      return;
    }
    afterNavigate();
  }, [pathname]);

  return (
    <div id="app" className={isReady ? undefined : 'is-loading'}>
      <Intro />
      {motion.customCursor && <CustomCursor />}
      <Menu />
      {settings.theme.layout.showTopNav && <Navbar />}
      <MenuLabel />
      {settings.features.ordering && <CartDrawer />}
      <div id="view" style={{ opacity: isReady ? 1 : 0 }}>
        {children}
      </div>
    </div>
  );
}
