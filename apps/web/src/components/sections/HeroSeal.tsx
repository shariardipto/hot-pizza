'use client';

import type { ImageValue } from '@app/shared/content';
import { BrandSealLarge } from '@/components/brand/Logos';
import { Media } from '@/components/ui/Media';
import { MotionParallax } from '@/components/ui/MotionParallax';
import { cx } from '@/lib/cx';

/** Rounded photo with the rotating seal (port of ContactHero). */
export function HeroSeal({ image, className }: { image: ImageValue | null; className?: string }) {
  return (
    <section className={cx('mt-fluid-200 flex items-center justify-center md:mt-fluid-120', className)}>
      <div className="relative max-md:w-col-4 md:max-lg:w-col-6 lg:w-col-8">
        {/* `hero__media` is also targeted by the intro animation (Intro.tsx). */}
        <MotionParallax className="hero__media rounded-(--radius)" tag="div" offset={10} scale={1.15}>
          <Media className="rounded-(--radius)" image={image} />
        </MotionParallax>
        <BrandSealLarge
          className={cx(
            'z-15 mx-auto mt-fluid-100 mb-0 w-[calc(var(--col-2)/1.7)]',
            'md:absolute md:top-1/2 md:right-0 md:w-col-2 md:transform-[translate3d(50%,0,0)]',
          )}
        />
      </div>
    </section>
  );
}
