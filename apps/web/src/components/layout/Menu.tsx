'use client';

import { gsap } from 'gsap';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type CSSProperties } from 'react';
import { BrandIcon } from '@/components/brand/Logos';
import { TLink } from '@/components/nav/TLink';
import { LinkLabel } from '@/components/ui/LinkLabel';
import { bus } from '@/lib/bus';
import { cx } from '@/lib/cx';
import { lenis } from '@/lib/lenis';
import { useSite, useT } from '@/lib/site';
import { ui, useUi } from '@/lib/store';
import { CartLink } from '@/components/commerce/CartLink';
import { LocaleSwitcher } from './LocaleSwitcher';

/** Fullscreen menu panel — shown/hidden by GSAP (opacity, visibility, pointer-events are animated inline). */
const panel = 'pointer-events-none invisible fixed top-0 left-0 z-25 flex h-dvh w-screen flex-col items-center justify-end bg-accent opacity-0';
const menuItem = 'flex w-full items-center justify-center gap-gutter px-0 py-16 text-center uppercase';
/** Small logo marking the current page, turned sideways on both sides of the label (both states of the icon's reveal). */
const activeIcon = (side: 'left' | 'right') =>
  side === 'left' ? 'transform-[rotate(-90deg)] inview:transform-[rotate(-90deg)]' : 'transform-[rotate(90deg)] inview:transform-[rotate(90deg)]';

function labelBounds() {
  const bg = document.querySelector<HTMLElement>('.menu-label__bg');
  const w = window.innerWidth;
  const h = window.innerHeight;
  const bw = bg?.clientWidth ?? 0;
  const bh = bg?.clientHeight ?? 0;
  return `inset(0px ${w / 2 - bw / 2}px ${h - bh}px ${w / 2 - bw / 2 - 1}px)`;
}

/** Full-screen menu revealed with a clip-path that grows out of the menu label. */
export function Menu() {
  const t = useT();
  const { settings } = useSite();
  const isMenuOpen = useUi((x) => x.isMenuOpen);
  const isClosingMenu = useUi((x) => x.isClosingMenu);
  const isMobile = useUi((x) => x.isMobile);
  const ref = useRef<HTMLElement>(null);
  const pathname = usePathname() || '/';

  const close = (done: () => void) => {
    const el = ref.current!;
    const tl = gsap.timeline();
    tl.to(el, {
      clipPath: labelBounds(),
      ease: 'expo.inOut',
      duration: 1.2,
      onComplete: () => {
        done();
        tl.kill();
        gsap.killTweensOf(el);
        gsap.set(el, { visibility: 'hidden', pointerEvents: 'none', opacity: 0 });
      },
    });
  };
  const closed = () => ui().set({ isMenuOpen: false, isClosingMenu: false });

  useEffect(() => {
    if (!isMenuOpen) return;
    lenis.stop();
    const el = ref.current!;
    const tl = gsap.timeline();
    tl.set(el, { opacity: 0, clipPath: labelBounds(), visibility: 'visible', pointerEvents: 'all' }).to(el, {
      clipPath: 'inset(0px 0px 0px 0px)',
      ease: 'expo.inOut',
      duration: 1.2,
      onStart: () => {
        gsap.set(el, { opacity: 1 });
      },
      onComplete: () => {
        tl.kill();
        gsap.killTweensOf(el);
      },
    });
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isClosingMenu) return;
    close(closed);
    lenis.start();
  }, [isClosingMenu]);

  useEffect(
    () =>
      bus.on('CLOSE_MENU', () => {
        close(closed);
        lenis.start();
      }),
    [],
  );

  // Escape closes the menu (accessibility addition).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ui().isMenuOpen && bus.emit('CLOSE_MENU');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = [
    { label: t('navHome', 'Home'), path: '/', match: (p: string) => /^\/([a-z]{2}(-[A-Za-z]+)?)?\/?$/.test(p) },
    { label: t('navProducts', 'Products'), path: '/products', match: (p: string) => /\/products(\/|$)/.test(p) },
    ...(settings.features.reservations
      ? [{ label: t('navReservations', 'Reservations'), path: '/reservations', match: (p: string) => /\/reservations(\/|$)/.test(p) }]
      : []),
  ];

  return (
    <aside ref={ref} id="menu" className={cx(panel, 'text-menu-links [--link-color:var(--c-menu-links)]', { 'is-open': isMenuOpen })} aria-hidden={!isMenuOpen} inert={!isMenuOpen}>
      {settings.features.languageSwitcher && settings.locales.length > 1 && settings.theme.layout.localeSwitcherPosition !== 'hidden' && (
        <div className="absolute top-offset right-offset flex gap-20 text-24 uppercase">
          <LocaleSwitcher />
        </div>
      )}
      <ul className="mb-fluid-40 w-width">
        {items.map((item, i) => {
          const active = item.match(pathname);
          return (
            <li key={item.path} className={menuItem} style={{ '--index': i + 1 } as CSSProperties}>
              <BrandIcon className={activeIcon('left')} style={{ '--text-color': 'var(--c-menu-links)', display: active ? undefined : 'none' } as CSSProperties} />
              <TLink href={item.path} className={cx({ 'text-240': !isMobile, 'text-110': isMobile })}>
                <LinkLabel text={item.label} underline={false} />
              </TLink>
              <BrandIcon className={activeIcon('right')} style={{ '--text-color': 'var(--c-menu-links)', display: active ? undefined : 'none' } as CSSProperties} />
            </li>
          );
        })}
        {settings.features.ordering && isMobile && (
          <li className={menuItem} style={{ '--index': items.length + 1 } as CSSProperties}>
            <CartLink className="text-110" />
          </li>
        )}
      </ul>
    </aside>
  );
}
