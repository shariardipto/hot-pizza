'use client';

import type { ImageValue } from '@app/shared/content';
import { TLink } from '@/components/nav/TLink';
import { Media } from '@/components/ui/Media';
import { cx } from '@/lib/cx';
import { useSite } from '@/lib/site';

const card = cx(
  'aspect-580/770 w-col-2 lg:w-col-3 rounded-[max(1.5rem,min(1.5vw,3rem))] origin-center will-change-transform',
  '[transition:transform_2s_var(--ease-expo),scale_1s_var(--ease-expo)] pointer-fine:hover:[scale:1.1]',
);

/** Three photo cards that fan out when scrolled into view (`group/cards` gets .is-inview). */
export function HomeCards({ imageLeft, imageCenter, imageRight, className }: { imageLeft: ImageValue | null; imageCenter: ImageValue | null; imageRight: ImageValue | null; className?: string }) {
  const { globals } = useSite();
  const label = globals.discover ?? 'Discover';
  const cards: [ImageValue | null, string][] = [
    [imageLeft, 'absolute top-0 z-1 transform-[rotate(12deg)_translateZ(0)] group-inview/cards:transform-[rotate(-14deg)_translate3d(-100%,0,0)]'],
    [imageCenter, 'z-2 transform-[rotate(-30deg)] group-inview/cards:transform-[rotate(0deg)]'],
    [imageRight, 'absolute top-0 z-3 transform-[rotate(-14deg)_translateZ(0)] group-inview/cards:transform-[rotate(14deg)_translate3d(100%,0,0)]'],
  ];
  return (
    <section className={cx('flex max-w-[100vw] items-center justify-center pb-fluid-120 max-md:overflow-hidden', className)}>
      <div className="group/cards relative aspect-580/770 w-col-2 lg:w-col-3" data-observe="once">
        {cards.map(([img, cls], i) => (
          <TLink key={i} href="/products" data-cursor-text={label} aria-label={label}>
            <Media className={cx(card, cls)} image={img} />
          </TLink>
        ))}
      </div>
    </section>
  );
}
