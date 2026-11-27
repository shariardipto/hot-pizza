'use client';

import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import type { CatalogProduct } from '@app/shared/content';
import { ProductBuy } from '@/components/commerce/ProductBuy';
import { Footer } from '@/components/layout/Footer';
import { ProductGallery, ProductInnovation, ProductSpecs } from '@/components/sections/ProductDetails';
import { ProductHero } from '@/components/sections/ProductHero';
import { ProductRelated } from '@/components/sections/ProductRelated';
import { TextBlock } from '@/components/ui/TextBlock';
import { TitleLarge } from '@/components/ui/TitleLarge';
import { bus } from '@/lib/bus';

export function ProductPage({ product }: { product: CatalogProduct }) {
  const d = product.data;
  const flavor = product.flavorEntry?.data;
  useEffect(() => {
    bus.emit('updateCursor');
    bus.emit('resetCursor');
  }, []);
  return (
    <main
      className="max-w-[100vw] bg-(--product-color) text-(color:--text-color)"
      style={{ '--product-color': flavor?.pageColor ?? undefined, '--text-color': flavor?.optimizeLegibility ? 'var(--c-secondary)' : undefined } as CSSProperties}
    >
      <div className="relative z-5">
        <ProductHero product={product} />
        <TextBlock className="mb-fluid-100" text={d.introDescription} title={d.introTitle} small md />
        <ProductGallery images={d.gallery} />
        <TitleLarge className="mb-fluid-40" title={d.title} titleSmallLeft={d.smallTitleLeft} titleSmallRight={d.smallTitleRight} />
        <TextBlock className="mb-fluid-120" text={d.description} md />
        <ProductInnovation
          className="mb-fluid-120"
          imageTradition={d.imageTradition}
          titleSmallLeftTradition={d.titleSmallLeftTradition}
          yearLeftTradition={d.yearLeftTradition}
          descriptionLeftTradition={d.descriptionLeftTradition}
          titleSmallRightTradition={d.titleSmallRightTradition}
          yearRightTradition={d.yearRightTradition}
          descriptionRightTradition={d.descriptionRightTradition}
        />
        <ProductSpecs className="pb-fluid-120" units={d.units} readyToEat={d.readyToEat} weight={d.weight} />
        <ProductBuy productId={product.id} offer={product.offer} />
      </div>
      <ProductRelated className="pb-fluid-160" slug={product.slug} />
      <Footer />
    </main>
  );
}
