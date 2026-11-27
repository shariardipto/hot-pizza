'use client';

import type { Catalog, ProductsPageContent } from '@app/shared/content';
import { useEffect } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/sections/Hero';
import { ProductsType } from '@/components/sections/ProductsType';
import { TextBlock } from '@/components/ui/TextBlock';
import { bus } from '@/lib/bus';

/** Catalogue: hero, intro, one section per menu category. */
export function ProductsPage({ page, catalog }: { page: ProductsPageContent; catalog: Catalog }) {
  useEffect(() => {
    bus.emit('updateCursor');
    bus.emit('resetCursor');
  }, []);
  // Only types that have products, ordered like the original store.
  const types = catalog.productTypes.filter((t) => catalog.products.some((p) => p.data.type === t.id));
  return (
    <main className="max-w-[100vw]">
      <Hero className="mb-fluid-100" image={page.image} title={page.titleLarge} titleSmallLeft={page.titleSmallLeft} titleSmallRight={page.titleSmallRight} />
      <TextBlock text={page.smallDescription} xsmall md />
      {types.map((t) => (
        <ProductsType
          key={t.id}
          title={t.data.name}
          titleSmallLeft={t.data.titleSmallLeft}
          titleSmallRight={t.data.titleSmallRight}
          image={t.data.image}
          description={t.data.description}
          products={catalog.products.filter((p) => p.data.type === t.id)}
        />
      ))}
      <Footer />
    </main>
  );
}
