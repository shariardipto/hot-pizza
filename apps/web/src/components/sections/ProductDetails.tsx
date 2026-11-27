'use client';

import type { ImageValue } from '@app/shared/content';
import { Container } from '@/components/ui/Container';
import { Media } from '@/components/ui/Media';
import { MotionHorizontalScroll } from '@/components/ui/MotionHorizontalScroll';
import { MotionTextChar } from '@/components/ui/MotionTextChar';
import { MotionTextLine } from '@/components/ui/MotionTextLine';
import { cx } from '@/lib/cx';
import { mdInline } from '@/lib/split';
import { useSite } from '@/lib/site';

/** Photo strip that follows the mouse (port of GalleryCursor). */
export function ProductGallery({ images, className }: { images: { _id: string; image: ImageValue | null }[]; className?: string }) {
  const { globals } = useSite();
  if (!images?.length) return null;
  return (
    <section className={cx('pb-fluid-160', className)} data-cursor-text={globals.discover ?? 'Discover'}>
      <MotionHorizontalScroll fromCenter>
        {images.map((g) => (
          <Media key={g._id} className="rounded-(--radius) max-md:w-col-3 lg:w-col-6" image={g.image} />
        ))}
      </MotionHorizontalScroll>
    </section>
  );
}

/** "From tradition / to the new tradition" with years and product image. */
export function ProductInnovation(p: {
  className?: string;
  imageTradition: ImageValue | null;
  titleSmallLeftTradition: string | null;
  yearLeftTradition: string | null;
  descriptionLeftTradition: string | null;
  titleSmallRightTradition: string | null;
  yearRightTradition: string | null;
  descriptionRightTradition: string | null;
}) {
  const col = (title: string | null, year: string | null, desc: string | null) => (
    <div className="flex flex-col items-center justify-center">
      <MotionTextLine className="text-24 mb-fluid-14 text-center" text={title} delay={1} />
      <MotionTextChar className="text-240 mb-fluid-14 text-center" text={year} delay={2} />
      <MotionTextLine className="text-24 text-center w-col-3" text={desc} delay={3} />
    </div>
  );
  return (
    <section className={p.className}>
      <Container className="grid gap-gutter-double lg:grid-cols-[repeat(3,var(--col-4))] lg:gap-gutter">
        {col(p.titleSmallLeftTradition, p.yearLeftTradition, p.descriptionLeftTradition)}
        <Media className="m-auto w-col-4 [&_img]:max-w-full [&_img]:object-contain" image={p.imageTradition} />
        {col(p.titleSmallRightTradition, p.yearRightTradition, p.descriptionRightTradition)}
      </Container>
    </section>
  );
}

export function ProductReadyBadge() {
  const { globals } = useSite();
  return (
    <div className="relative flex items-center justify-center self-center rounded-[100%] p-40 text-right text-(color:--product-color) uppercase [&_span]:relative [&_span]:z-1">
      <span dangerouslySetInnerHTML={{ __html: mdInline(globals.badge) }} />
      <svg className="absolute z-0" width="191" height="74" viewBox="0 0 191 74" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M0 0H191L171 37L191 74H0L20 37L0 0Z" fill="var(--text-color)" />
      </svg>
    </div>
  );
}

export function ProductSpecs({ units, weight, readyToEat = true, className }: { units: string | null; weight: string | null; readyToEat?: boolean | null; className?: string }) {
  const { globals } = useSite();
  return (
    <section className={className}>
      <Container
        className={cx(
          'grid w-[calc(var(--col-5)_+_var(--gutter))] grid-flow-col place-items-center gap-gutter-double xl:w-[calc(var(--col-4)_+_var(--gutter))]',
          'max-md:flex max-md:w-width max-md:flex-col max-md:gap-0',
        )}
      >
        <span className="uppercase self-center text-right">
          {units} {globals.units}
        </span>
        {readyToEat !== false ? <ProductReadyBadge /> : null}
        <span className="self-center">
          <span className="uppercase">{globals.weight}</span> {weight}
        </span>
      </Container>
    </section>
  );
}
