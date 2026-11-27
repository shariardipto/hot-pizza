'use client';

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';
import { cx } from '@/lib/cx';
import { lenis } from '@/lib/lenis';
import { useSite } from '@/lib/site';
import { ui, useUi } from '@/lib/store';
import { LogoMorphing } from './LogoMorphing';


type Els = {
  intro: HTMLElement;
  logo: HTMLElement;
  bg: HTMLElement;
  menuLabel: HTMLElement;
  logoTarget: DOMRect;
  hamburger: HTMLElement[];
};

/**
 * First-load intro (logo rises, then shrinks into the header while the red panel collapses into the
 * menu label) and page-transition cover (the same panel expands to full screen while navigating).
 * Timings / easings are identical to the original.
 */
export function Intro() {
  const introRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const els = useRef<Els | null>(null);
  const isFirstLoad = useUi((x) => x.isFirstLoad);
  const isNavigating = useUi((x) => x.isNavigating);
  const { settings } = useSite();
  const introEnabled = settings.theme.motion.intro;
  // Last navigation state acted on. Comparing with it (instead of a "first run" flag) keeps the cover/uncover effect
  // from firing on React's development double-run of effects, which used to collapse the red panel mid-intro.
  const lastNavigating = useRef(isNavigating);

  const showHamburger = () => {
    const e = els.current;
    if (!e) return;
    gsap.to(e.hamburger, { yPercent: 0, opacity: 1, duration: 0.5, clearProps: 'all', stagger: { from: 'end', amount: 0.075 }, ease: 'expo.out' });
  };

  useEffect(() => {
    const intro = introRef.current!;
    const logo = logoRef.current!;
    const bg = bgRef.current!;
    const menuLabel = document.querySelector<HTMLElement>('#menu-label')!;
    // Where the intro logo lands: the header's logo. An uploaded logo sits inside side margins within the link box,
    // so aim at the image itself (otherwise the intro logo ends wider — and taller — than the header logo, then jumps).
    const target =
      menuLabel.querySelector<HTMLElement>('.menu-label__logos img:not(.menu-label__mark)') ??
      menuLabel.querySelector<HTMLElement>('.menu-label__logos')!;
    els.current = {
      intro,
      logo,
      bg,
      menuLabel,
      logoTarget: target.getBoundingClientRect(),
      hamburger: Array.from(document.querySelectorAll<HTMLElement>('.menu-label__line')),
    };
    ui().set({ isTransitioning: true });
    lenis.stop();

    const finish = () => {
      lenis.start();
      ui().set({ isFirstLoad: false });
      document.body.classList.add('is-loaded');
      gsap.set(intro, { visibility: 'hidden' });
      gsap.set(logo, { display: 'none' });
    };

    if (!introEnabled) {
      gsap.set(bg, { width: menuLabel.clientWidth, height: menuLabel.clientHeight });
      gsap.delayedCall(0.35, () => ui().set({ isTransitioning: false }));
      finish();
      return;
    }

    let logoIn = false;
    let imagesReady = false;
    let revealed = false;

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      const e = els.current!;
      const tl = gsap.timeline();
      tl.set(e.hamburger, { yPercent: -500, opacity: 0 });
      // Same (quirky) call as the original: duration/ease in the "from" vars are ignored by GSAP.
      gsap.fromTo('.hero__media', { scale: 1.4, duration: 3, delay: 0.75, ease: 'expo.out', force3D: true, clearProps: 'all' }, { scale: 1 });
      gsap.delayedCall(0.35, () => ui().set({ isTransitioning: false }));
      tl.to(logo, { top: e.logoTarget.top, width: e.logoTarget.width, height: e.logoTarget.height, ease: 'expo.inOut', duration: 1.25, force3D: true });
      tl.to(
        bg,
        {
          width: e.menuLabel.clientWidth,
          height: e.menuLabel.clientHeight,
          ease: 'expo.inOut',
          duration: 1.35,
          force3D: true,
          onComplete: () => {
            tl.kill();
            gsap.killTweensOf(bg);
            gsap.killTweensOf(logo);
            finish();
            showHamburger();
          },
        },
        0,
      );
    };

    // Like the original, the logo waits in the middle until the images of the first screen (the hero photo) have
    // loaded, so the panel never opens onto an empty page. Images further down (lazy, loaded on scroll) are not
    // waited for, and the wait is capped at 3 s after the logo has arrived.
    const imgs = Array.from(document.body.querySelectorAll('img')).filter((img) => img.getBoundingClientRect().top < window.innerHeight);
    let loaded = 0;
    const onImg = () => {
      if (++loaded === imgs.length) {
        imagesReady = true;
        if (logoIn) reveal();
      }
    };
    if (!imgs.length) imagesReady = true;
    imgs.forEach((img) => {
      if (img.complete && img.naturalHeight !== 0) onImg();
      else {
        img.addEventListener('load', onImg, { once: true });
        img.addEventListener('error', onImg, { once: true });
      }
    });

    const enter = gsap.timeline();
    enter.set(logo, { y: '100vh', opacity: 1, force3D: true });
    enter.to(logo, {
      y: 0,
      duration: 1,
      delay: 0.35,
      ease: 'expo.out',
      onComplete: () => {
        logoIn = true;
        if (imagesReady) {
          reveal();
          enter.kill();
        } else {
          window.setTimeout(() => {
            if (!imagesReady) {
              reveal();
              enter.kill();
            }
          }, 3000);
        }
      },
    });
    return () => {
      enter.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Page transition cover / uncover.
  useEffect(() => {
    if (lastNavigating.current === isNavigating) return;
    lastNavigating.current = isNavigating;
    const e = els.current;
    if (!e) return;
    if (isNavigating) {
      gsap.set(e.intro, { visibility: 'visible' });
      gsap.to(e.hamburger, { yPercent: -500, opacity: 0, duration: 0.5, stagger: { from: 'start', amount: 0.075 }, ease: 'expo.out' });
      ui().set({ isMenuCollapsed: false });
      gsap.to(e.bg, {
        width: window.innerWidth,
        height: window.innerHeight,
        ease: 'expo.inOut',
        force3D: true,
        duration: 1,
        delay: 0.2,
        onComplete: () => gsap.killTweensOf(e.bg),
      });
    } else {
      const tl = gsap.timeline();
      tl.to(
        e.bg,
        {
          width: e.menuLabel.clientWidth,
          height: e.menuLabel.clientHeight,
          ease: 'expo.inOut',
          duration: 1,
          force3D: true,
          onComplete: () => {
            showHamburger();
            tl.kill();
            gsap.killTweensOf(e.bg);
            gsap.set(e.intro, { visibility: 'hidden' });
          },
        },
        0,
      );
    }
  }, [isNavigating]);

  return (
    <div
      ref={introRef}
      className={cx(
        'fixed z-29 flex h-(--height) w-screen flex-col place-content-center items-center justify-center text-secondary',
        isFirstLoad && 'z-40',
      )}
      aria-hidden="true"
    >
      <LogoMorphing ref={logoRef} className="absolute z-10 w-[max(30rem,min(30vw,60rem))] opacity-0" />
      <div ref={bgRef} className="absolute top-0 z-5 h-screen w-screen bg-accent" />
    </div>
  );
}
