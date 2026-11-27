'use client';

import type { AboutChapterBlock, AboutImageBlock } from '@app/shared/content';
import { BrandIcon } from '@/components/brand/Logos';
import { TLink } from '@/components/nav/TLink';
import { Container } from '@/components/ui/Container';
import { Media } from '@/components/ui/Media';
import { MotionHorizontalScroll } from '@/components/ui/MotionHorizontalScroll';
import { TextBlock } from '@/components/ui/TextBlock';
import { TitleLarge } from '@/components/ui/TitleLarge';
import { cx } from '@/lib/cx';
import { mdInline } from '@/lib/split';
import { useSite } from '@/lib/site';
import { ProductCard } from './ProductCard';

/** Colored chapter panel (port of the `about_chapter` slice). */
export function AboutChapter({ block }: { block: AboutChapterBlock }) {
  return (
    <section
      className="relative z-5 flex min-h-screen items-center justify-center py-fluid-200"
      style={{ background: block.color ?? undefined, color: block.optimizeLegibility ? 'var(--c-secondary)' : undefined }}
      data-slice-type="about_chapter"
      data-slice-variation="default"
    >
      <Container className="flex flex-col items-center justify-center">
        <TitleLarge className="mb-fluid-60" title={block.title} titleSmallLeft={block.titleSmallLeft} titleSmallRight={block.titleSmallRight} small={Boolean(block.secondary)} large={false} />
        {block.secondary ? <BrandIcon className="mb-fluid-40" /> : null}
        <p className="text-center md:max-lg:w-col-6 lg:w-col-8 max-md:w-col-4" dangerouslySetInnerHTML={{ __html: mdInline(block.description) }} />
      </Container>
    </section>
  );
}

/** Full-screen photo that zooms out when in view (port of the `chapter_image` slice; `group/chapter` gets .is-inview). */
export function ChapterImage({ block }: { block: AboutImageBlock }) {
  return (
    <section className="group/chapter relative z-5 h-screen w-screen overflow-hidden bg-[blue]" data-slice-type="chapter_image" data-slice-variation="default" data-observe="">
      <Media
        className={cx(
          'h-full w-full object-cover transform-[scale(1.4)] [transition:transform_0s_var(--ease-expo)]',
          'group-inview/chapter:transform-[scale(1)] group-inview/chapter:[transition:transform_4s_var(--ease-expo)]',
        )}
        image={block.image}
        thumb
        width={1920}
      />
    </section>
  );
}

/** Last chapter: products carousel on the accent color. */
export function AboutProducts({ title, titleSmallLeft, titleSmallRight, description }: { title: string | null; titleSmallLeft: string | null; titleSmallRight: string | null; description: string | null }) {
  const { products: all } = useSite();
  const sorted = [...all].sort((a, b) => (a.typeEntry?.sortOrder ?? 0) - (b.typeEntry?.sortOrder ?? 0));
  return (
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center py-fluid-200" style={{ background: 'var(--c-accent)', color: 'var(--c-secondary)' }}>
      <Container>
        <TitleLarge className="mb-fluid-80" title={title} titleSmallLeft={titleSmallLeft} titleSmallRight={titleSmallRight} />
      </Container>
      <MotionHorizontalScroll className="mb-fluid-60" fromCenter>
        {sorted.map((p) => (
          <TLink key={p.id} href={`/products/${p.slug}`}>
            <ProductCard product={{ image: p.data.image?.url, flavorColor: p.flavorEntry?.data.color, optimizeLegibility: p.flavorEntry?.data.optimizeLegibility }} />
          </TLink>
        ))}
      </MotionHorizontalScroll>
      <Container>
        <TextBlock withIcon={false} text={description} md />
      </Container>
    </section>
  );
}
