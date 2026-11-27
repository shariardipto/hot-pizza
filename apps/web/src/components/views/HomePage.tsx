'use client';

import type { HomeContent } from '@app/shared/content';
import type { HomeSectionKey } from '@app/shared/theme';
import { Fragment, useEffect } from 'react';
import { Footer } from '@/components/layout/Footer';
import { TLink } from '@/components/nav/TLink';
import { Hero } from '@/components/sections/Hero';
import { HomeAward } from '@/components/sections/HomeAward';
import { HomeCards } from '@/components/sections/HomeCards';
import { HomeSticky } from '@/components/sections/HomeSticky';
import { ProductShowcase } from '@/components/sections/ProductShowcase';
import { MotionLabel } from '@/components/ui/MotionLabel';
import { TextBlock } from '@/components/ui/TextBlock';
import { TitleLarge } from '@/components/ui/TitleLarge';
import { bus } from '@/lib/bus';
import { cx } from '@/lib/cx';
import { useSite, useT } from '@/lib/site';

/** Pill links (our locations, reservations): the arrow-shaped clip opens when scrolled into view. */
const bannerLink = cx(
  'group/banner border-b-2 border-b-accent bg-accent text-center text-secondary',
  'p-[calc(var(--gutter)/1.5)_calc(var(--gutter)*1.5)]',
  '[clip-path:polygon(88%_0,88%_50%,88%_100%,12%_100%,12%_50%,12%_0)] transform-[scaleX(0.8)]',
  '[transition:clip-path_2s_var(--ease-expo),transform_1s_var(--ease-expo)]',
  'inview:[clip-path:polygon(100%_1%,92%_50%,100%_100%,0_100%,8%_50%,0_0)] inview:transform-[scaleX(1)]',
);
const bannerLabel = 'uppercase text-center opacity-0 [transition:opacity_2s_var(--ease-expo)] group-inview/banner:opacity-100';

export function HomePage({ page }: { page: HomeContent }) {
  const { globals, settings } = useSite();
  const t = useT();
  useEffect(() => {
    bus.emit('updateCursor');
    bus.emit('resetCursor');
  }, []);

  const sections: Record<HomeSectionKey, () => React.ReactNode> = {
    hero: () => <Hero className="mb-fluid-100" image={page.heroImage} title={page.heroTitleLarge} titleSmallLeft={page.heroTitleSmallLeft} titleSmallRight={page.heroTitleSmallRight} />,
    intro: () => <TextBlock className="mb-fluid-160" text={page.introParagraph} title={page.introTitle} />,
    cards: () => <HomeCards className="mb-fluid-160" imageLeft={page.imageLeft} imageCenter={page.imageCenter} imageRight={page.imageRight} />,
    description: () => (
      <>
        <TitleLarge className="mb-fluid-40" title={page.descriptionTitleLarge} titleSmallLeft={page.descriptionTitleSmallLeft} titleSmallRight={page.descriptionTitleSmallRight} />
        <TextBlock className="mb-fluid-200" text={page.descriptionParagraph} />
      </>
    ),
    banners: () => (
      <section className="mb-fluid-160 flex w-full items-center justify-center gap-gutter">
        {page.showLocations && settings.features.locationsPage ? (
          <TLink className={bannerLink} data-observe="" href="/locations" aria-label={globals.locationsLabel ?? undefined}>
            <MotionLabel className={bannerLabel} text={globals.locationsLabel} />
          </TLink>
        ) : null}
        {settings.features.reservations ? (
          <TLink className={bannerLink} data-observe="" href="/reservations" aria-label={t('reservationSubmit', 'Book a table')}>
            <MotionLabel className={bannerLabel} text={t('reservationSubmit', 'Book a table')} />
          </TLink>
        ) : null}
      </section>
    ),
    sticky: () => <HomeSticky image={page.bigSectionImage} titleUp={page.bigSectionTitleUp} titleDown={page.bigSectionTitleBottom} />,
    showcase: () => <ProductShowcase />,
    award: () => <HomeAward title={page.awardTitle} image={page.awardImage} description={page.awardDescription} />,
  };

  // Original order: hero, intro, cards, description, banners, sticky, showcase, award — admin can reorder / hide.
  const order = settings.theme.layout.homeSections?.length
    ? settings.theme.layout.homeSections
    : (['hero', 'intro', 'cards', 'description', 'banners', 'sticky', 'showcase', 'award'] as HomeSectionKey[]).map((key) => ({ key, visible: true }));

  return (
    <main className="max-w-[100vw]">
      {order.filter((x) => x.visible).map((x) => <Fragment key={x.key}>{sections[x.key]?.()}</Fragment>)}
      <Footer />
    </main>
  );
}
