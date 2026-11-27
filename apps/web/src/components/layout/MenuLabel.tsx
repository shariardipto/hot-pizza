'use client';

import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { TLink } from '@/components/nav/TLink';
import { bus } from '@/lib/bus';
import { cx } from '@/lib/cx';
import { lenis } from '@/lib/lenis';
import { useSite, useT } from '@/lib/site';
import { ui, useUi } from '@/lib/store';
import { LogoMorphing } from './LogoMorphing';

gsap.registerPlugin(Flip);

/**
 * JS hooks (keep these class names): .menu-label__logos and .menu-label__line are animated by the intro (Intro.tsx),
 * .menu-label__bg by the menu (Menu.tsx).
 */
const line = cx(
  'menu-label__line relative flex h-[2px] w-full origin-center bg-secondary [transition:transform_1s_var(--ease-expo)]',
);

/** Fixed top-center label: hamburger + logo, collapses into the monogram on scroll (GSAP Flip). */
export function MenuLabel() {
  const t = useT();
  const isMenuCollapsed = useUi((x) => x.isMenuCollapsed);
  const isMenuOpen = useUi((x) => x.isMenuOpen);
  const isTransitioning = useUi((x) => x.isTransitioning);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { settings } = useSite();
  const logo = settings.theme.logo;
  /** Uploaded logo: the collapsed pill is sized to the compact mark instead of a fixed share of the header. */
  const imageLogo = logo.mode === 'image' && Boolean(logo.image);
  const imageLogoRef = useRef(imageLogo);
  imageLogoRef.current = imageLogo;

  const labelRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const st = useRef({ canCollapse: false, isCollapsed: false, isAnimating: false, collapsedWhileAnimation: false, lastCollapsed: false });

  function flip(collapse: boolean) {
    const r = st.current;
    if (r.isAnimating || !labelRef.current || !bgRef.current || !hamburgerRef.current) return;
    r.isAnimating = true;
    r.collapsedWhileAnimation = collapse;
    const state = Flip.getState([labelRef.current, bgRef.current, hamburgerRef.current], { props: 'width, height, opacity, gap' });
    bgRef.current.classList.toggle('is-collapsed', collapse);
    // Uploaded logo: full logo ↔ compact mark (LogoMorphing CSS) — set here so it starts with the panel's Flip.
    labelRef.current.dataset.logo = collapse ? 'mark' : 'full';
    // Menu lines: 12% / 30% of the design width. With an uploaded logo the panel hugs the logo (narrower than the
    // design), so the same share is written against the design width (24vw, clamped 24–48rem) instead of the panel.
    // (A plain % of the current panel: GSAP cannot tween CSS max()/min() and animated the lines from 0 width.)
    const share = collapse ? 0.12 : 0.3;
    let lineWidth = `${share * 100}%`;
    if (imageLogoRef.current && labelRef.current.clientWidth) {
      // % is of the panel's inner width, so compare inner widths (design vs current panel).
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
      const padding = 2 * (parseFloat(getComputedStyle(labelRef.current).paddingLeft) || 0);
      const designInner = Math.max(24 * rem, Math.min(0.24 * window.innerWidth, 48 * rem)) - padding;
      const currentInner = labelRef.current.clientWidth - padding;
      if (currentInner > 0) lineWidth = `${((share * designInner) / currentInner) * 100}%`;
    }
    gsap.set(hamburgerRef.current, { width: lineWidth, gap: collapse || ui().isMobile ? '0.5rem' : '1rem' });
    r.isCollapsed = collapse;
    setIsCollapsed(collapse);
    Flip.from(state, {
      delay: collapse ? 0.25 : 0,
      duration: 0.5,
      ease: collapse ? 'expo.inOut' : 'expo.out',
      prune: true,
      force3D: true,
      onComplete: () => {
        Flip.killFlipsOf(hamburgerRef.current);
        Flip.killFlipsOf(bgRef.current);
        r.isAnimating = false;
        if (r.collapsedWhileAnimation !== ui().isMenuCollapsed) flip(ui().isMenuCollapsed);
      },
    });
  }

  useEffect(() => {
    if (isMenuCollapsed !== st.current.isCollapsed) flip(isMenuCollapsed);
  }, [isMenuCollapsed]);

  // Page transitions show the full logo (as the text logo does); otherwise keep data-logo in step with the state.
  useEffect(() => {
    if (labelRef.current) labelRef.current.dataset.logo = isCollapsed && !isTransitioning ? 'mark' : 'full';
  }, [isCollapsed, isTransitioning]);

  // Uploaded logo: the collapsed pill ends just below the compact mark (--logo-pill-h). Measured with the collapsed
  // menu-line gap, so the value is the same whether the header is open or collapsed.
  useEffect(() => {
    const label = labelRef.current;
    const bg = bgRef.current;
    const burger = hamburgerRef.current;
    const mark = label?.querySelector<HTMLImageElement>('.menu-label__mark');
    if (!imageLogo || !label || !bg || !burger || !mark) return;
    const update = () => {
      let top = 0;
      for (let n: HTMLElement | null = mark; n && n !== label; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 10;
      const gapNow = parseFloat(getComputedStyle(burger).rowGap) || 0;
      const pad = parseFloat(getComputedStyle(label).paddingTop) || 0;
      const height = top - (gapNow - 0.5 * rem) + mark.offsetHeight + pad * 1.5;
      if (mark.offsetHeight) bg.style.setProperty('--logo-pill-h', `${Math.round(height)}px`);
    };
    update();
    mark.addEventListener('load', update);
    const ro = new ResizeObserver(update);
    ro.observe(mark);
    window.addEventListener('resize', update);
    return () => {
      mark.removeEventListener('load', update);
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [imageLogo, logo.image?.url, logo.compactImage?.url]);

  useEffect(() => {
    st.current.canCollapse = !isMenuOpen;
    if (st.current.canCollapse && st.current.lastCollapsed) ui().set({ isMenuCollapsed: true });
  }, [isMenuOpen]);

  useEffect(
    () =>
      lenis.on('scroll', (e) => {
        const past = e.scroll > 100;
        st.current.canCollapse = past;
        if (st.current.lastCollapsed !== past) {
          ui().set({ isMenuCollapsed: past });
          st.current.lastCollapsed = past;
        }
      }),
    [],
  );

  function setCollapsed(v: boolean) {
    if (st.current.canCollapse && !ui().isMenuOpen) ui().set({ isMenuCollapsed: v });
  }

  function toggleMenu() {
    const s0 = ui();
    if (s0.isMenuOpen) bus.emit('CLOSE_MENU');
    else {
      gsap.delayedCall(s0.isMenuCollapsed ? 0.5 : 0, () => ui().set({ isMenuOpen: true }));
      if (s0.isMenuCollapsed) s0.set({ isMenuCollapsed: false });
    }
  }

  const collapsedVisible = isCollapsed && !isTransitioning;

  return (
    <div
      ref={labelRef}
      id="menu-label"
      className={cx(
        'fixed top-0 right-0 left-0 z-30 mx-auto my-0 p-[4%] opacity-100 md:p-[1.5%]',
        imageLogo
          ? // Uploaded logo: the panel hugs the logo. The logo is drawn as tall as half the design's inner width
            // (--lw = design width, --lp = padding), so the panel is that height × the logo's aspect ratio plus padding
            // and a half-padding margin each side — never wider than the design, never narrower than half of it.
            '[--lw:max(24rem,min(24vw,48rem))] [--lp:4vw] md:[--lp:1.5vw] w-[max(calc(var(--lw)*0.5),min(var(--lw),calc((var(--lw)-2*var(--lp))*0.5*var(--logo-aspect,2.88)+3*var(--lp))))]'
          : 'w-[max(24rem,min(24vw,48rem))]',
        { 'is-collapsed': isCollapsed, 'is-menu-open': isMenuOpen },
        // Collapsed, only what is visible reacts to the pointer (the pill, the menu lines and the mark); the rest of
        // the header's box lets hovers and clicks through to the page instead of re-opening the header. Keyed on
        // data-logo (set in flip) so it switches on the same frame as the logo — a React-driven class switched a render
        // later, and in that gap the pointer "left" the header and collapsed it again.
        'data-[logo=mark]:pointer-events-none',
      )}
      style={imageLogo && logo.image?.width && logo.image.height ? ({ '--logo-aspect': logo.image.width / logo.image.height } as CSSProperties) : undefined}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(st.current.canCollapse)}
    >
      <div className="relative z-10 flex cursor-pointer flex-col items-center justify-between gap-30">
        <button
          ref={hamburgerRef}
          className="pointer-events-auto z-10 flex w-[max(6rem,min(6vw,10rem))] flex-col gap-5 [transition:transform_0.75s_var(--ease-expo)] hover:transform-[scaleX(0.8)] md:gap-10"
          aria-label={isMenuOpen ? t('menuClose', 'Close') : t('menuLabel', 'Menu')}
          aria-expanded={isMenuOpen}
          aria-controls="menu"
          onClick={toggleMenu}
        >
          {/* The two lines tilt into an "x" while the menu is open */}
          <div className={cx(line, '[.is-menu-open_&]:transform-[translate3d(0,0.6rem,0)_rotate(-8deg)] max-md:[.is-menu-open_&]:transform-[translate3d(0,0.35rem,0)_rotate(-8deg)]')} />
          <div className={cx(line, '[.is-menu-open_&]:transform-[translate3d(0,-0.6rem,0)_rotate(8deg)] max-md:[.is-menu-open_&]:transform-[translate3d(0,-0.35rem,0)_rotate(8deg)]')} />
        </button>
        <TLink
          href="/"
          className={cx(
            'menu-label__logos relative z-5 grid grid-cols-[100%] grid-rows-[100%] flex-col',
            // Uploaded logo: full panel width less a half-padding margin each side (see the panel width above).
            imageLogo && 'w-full px-[calc(var(--lp)*0.5)]',
            // The text logo's letter mark glides up into the pill; an uploaded compact mark already sits right under the menu lines.
            collapsedVisible && !imageLogo
              ? 'transform-[translate3d(0,-45%,0)] [transition:transform_0.5s_var(--ease-expo)_0.4s] md:transform-[scale(0.8)_translate3d(0,-55%,0)] xl:transform-[scale(0.8)_translate3d(0,-45%,0)]'
              : '[transition:transform_0.4s_var(--ease-in-out-expo)]',
          )}
          aria-label={t('navHome', 'Homepage')}>
          <LogoMorphing collapsed={collapsedVisible} />
        </TLink>
      </div>
      {/* Red pill behind the logo; .is-collapsed is toggled by the Flip animation above */}
      <div
        ref={bgRef}
        className={cx(
          'menu-label__bg pointer-events-auto absolute top-0 right-0 left-0 z-5 mx-auto my-0 h-full w-full origin-center bg-accent will-change-[height,width]',
          '[&.is-collapsed]:w-[max(6rem,min(6vw,10rem))]',
          imageLogo ? '[&.is-collapsed]:h-[var(--logo-pill-h,70%)]' : '[&.is-collapsed]:h-[80%] md:[&.is-collapsed]:h-[70%]',
        )}
      />
    </div>
  );
}
