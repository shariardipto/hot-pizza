'use client';

import type { ImageValue } from '@app/shared/content';
import { TLink } from '@/components/nav/TLink';
import { Container } from '@/components/ui/Container';
import { Media } from '@/components/ui/Media';
import { MotionParallax } from '@/components/ui/MotionParallax';
import { TextBlock } from '@/components/ui/TextBlock';
import { TitleLarge } from '@/components/ui/TitleLarge';
import { cx } from '@/lib/cx';
import type { SiteValue } from '@/lib/site';
import { ProductCard } from './ProductCard';

/** One menu category on the catalogue page (title, photo, description, product cards). */
export function ProductsType({
  title,
  titleSmallLeft,
  titleSmallRight,
  description,
  image,
  products = [],
}: {
  title: string | null;
  titleSmallLeft?: string | null;
  titleSmallRight?: string | null;
  description?: string | null;
  image?: ImageValue | null;
  products?: SiteValue['products'];
}) {
  return (
    <section className="py-fluid-120">
      <Container className="flex flex-col items-center justify-center">
        {title ? <TitleLarge className={cx('uppercase', { 'mb-fluid-40': !image })} title={title} titleSmallLeft={titleSmallLeft} titleSmallRight={titleSmallRight} /> : null}
        {image ? (
          <MotionParallax className="mt-fluid-40 mb-fluid-80 overflow-hidden rounded-(--radius)" tag="div" offset={10} scale={1.15}>
            <Media className="aspect-1220/680 lg:w-col-8" image={image} thumb />
          </MotionParallax>
        ) : null}
        <TextBlock className="mb-fluid-120" text={description} small />
      </Container>
      {/* Phone: horizontally scrolling, snapping row. Tablet+: centered row. */}
      <div
        className={cx(
          'grid gap-gutter px-offset',
          'max-md:grid-flow-col max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto max-md:whitespace-nowrap max-md:*:snap-center max-md:[&::-webkit-scrollbar]:hidden',
          'md:grid-flow-col md:place-content-center',
        )}
      >
        {products.map((p) => (
          <TLink key={p.id} href={`/products/${p.slug}`}>
            <ProductCard
              product={{ image: p.data.image?.url, flavorColor: p.flavorEntry?.data.color, optimizeLegibility: p.flavorEntry?.data.optimizeLegibility }}
            />
          </TLink>
        ))}
      </div>
    </section>
  );
}
