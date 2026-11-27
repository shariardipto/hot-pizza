'use client';

import type { ImageValue } from '@app/shared/content';
import { Media } from '@/components/ui/Media';
import { MotionParallax } from '@/components/ui/MotionParallax';
import { TitleLarge } from '@/components/ui/TitleLarge';
import { cx } from '@/lib/cx';
import { useUi } from '@/lib/store';
const BLANK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1' height='1'/%3E";

/** Full-height hero: image with parallax + huge title (port of Hero). */
export function Hero({
  image,
  title,
  titleSmallLeft,
  titleSmallRight,
  className,
}: {
  image: ImageValue | null;
  title: string | null;
  titleSmallLeft?: string | null;
  titleSmallRight?: string | null;
  className?: string;
}) {
  const isTransitioning = useUi((x) => x.isTransitioning);
  return (
    <section className={cx('relative flex aspect-1920/1290 max-w-[100vw] min-h-(--height) items-end justify-start overflow-hidden bg-secondary', className)}>
      <div className="z-10 flex h-full w-screen items-end justify-center pb-offset-double md:pb-col-1">
        <TitleLarge
          className="text-alt"
          title={title}
          titleSmallLeft={titleSmallLeft ?? null}
          titleSmallRight={titleSmallRight ?? null}
          large
          tag="h1"
          style={isTransitioning ? { display: 'none' } : undefined}
        />
        {/* Accessible page title (the visual title is split into decorative characters). */}
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{title?.replaceAll('\n', ' ')}</span>
      </div>
      {/* Zooms in while a page transition covers the screen. `hero__media` is the hook the intro animation targets. */}
      <div
        className={cx(
          'hero__media absolute top-0 left-0 z-5 flex h-full w-full will-change-transform [transition:transform_2s_var(--ease-expo)]',
          isTransitioning ? 'transform-[scale(1.2)]' : 'transform-[scale(1)]',
        )}
      >
        <MotionParallax tag="div" offset={10} scale={1.15} className="h-full" innerClassName="h-full">
          <Media className="h-full" image={image?.url ?? BLANK} thumb width={1920} height={1290} alt={image?.alt} />
        </MotionParallax>
      </div>
    </section>
  );
}
