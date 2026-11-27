'use client';

import type { AboutContent } from '@app/shared/content';
import { useEffect } from 'react';
import { Footer } from '@/components/layout/Footer';
import { AboutChapter, AboutProducts, ChapterImage } from '@/components/sections/AboutSections';
import { Hero } from '@/components/sections/Hero';
import { bus } from '@/lib/bus';


export function AboutPage({ page }: { page: AboutContent }) {
  useEffect(() => {
    bus.emit('updateCursor');
    bus.emit('resetCursor');
  }, []);
  return (
    <main className="max-w-[100vw] bg-[#000]">
      <Hero image={page.heroImage} title={page.heroTitleLarge} titleSmallLeft={page.heroTitleSmallLeft} titleSmallRight={page.heroTitleSmallRight} />
      <div className="content">
        {page.chapters.map((b) => (b._type === 'image' ? <ChapterImage key={b._id} block={b} /> : <AboutChapter key={b._id} block={b} />))}
      </div>
      <AboutProducts
        title={page.productsChapterTitle}
        titleSmallLeft={page.productsChapterTitleSmallLeft}
        titleSmallRight={page.productsChapterTitleSmallRight}
        description={page.productsChapterDescription}
      />
      <Footer />
    </main>
  );
}
