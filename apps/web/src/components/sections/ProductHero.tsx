'use client';

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';
import type { CatalogProduct } from '@app/shared/content';
import { TLink } from '@/components/nav/TLink';
import { LinkLabel } from '@/components/ui/LinkLabel';
import { MotionTextChar } from '@/components/ui/MotionTextChar';
import { useSite } from '@/lib/site';
import { useUi } from '@/lib/store';
import { ProductModel, type ProductModelHandle } from './ProductModel';

/** Big product name + product image + links to the other flavors of the same category. */
export function ProductHero({ product }: { product: CatalogProduct }) {
  const { globals, products } = useSite();
  const isMobile = useUi((x) => x.isMobile);
  const isTransitioning = useUi((x) => x.isTransitioning);
  const model = useRef<ProductModelHandle>(null);
  const prev = useRef(isTransitioning);
  const flavorName = product.flavorEntry?.data.name ?? '';
  const flavorLine = [globals.productPrefix, flavorName].filter(Boolean).join(' ');
  const sameType = products.filter((p) => p.typeEntry?.id === product.typeEntry?.id);

  // Slide the product in when the page transition ends (watcher on isTransitioning → false).
  useEffect(() => {
    const was = prev.current;
    prev.current = isTransitioning;
    if (!was || isTransitioning) return;
    const el = model.current?.el;
    if (!el) return;
    gsap.from(el, { x: '-100vw', duration: 1, ease: 'quart.out', delay: 0.25, onStart: () => model.current?.animateIn() });
  }, [isTransitioning]);

  const hidden = { display: 'none' } as const;
  return (
    <section className="product-hero mb-fluid-120 flex w-screen flex-col items-center justify-start pt-[calc(max(30rem,min(30vw,48rem))/1.5)] lg:min-h-(--height)">
      <h1 className="absolute right-0 left-0 flex flex-col text-center uppercase" aria-label={[globals.productWordTop, globals.productWordBottom, flavorLine].filter(Boolean).join(' ')}>
        <MotionTextChar className="text-340" lineHeight="80%" aria-hidden="true" text={globals.productWordTop} delay={1} tag="span" style={isTransitioning ? hidden : undefined} />
        <MotionTextChar className="order-3 text-340" lineHeight="80%" aria-hidden="true" text={globals.productWordBottom} delay={3} tag="span" style={isTransitioning ? hidden : undefined} />
        <MotionTextChar
          className="order-2 text-110"
          aria-hidden="true"
          text={flavorLine}
          tag="span"
          delay={2}
          style={isMobile || isTransitioning ? hidden : undefined}
        />
      </h1>
      <div className="flex items-center justify-center transform-[translate3d(0,10%,0)] max-md:w-col-4 md:max-lg:w-col-3 lg:w-col-4">
        <ProductModel ref={model} poster={product.data.image?.url ?? null} alt={product.data.image?.alt || flavorName} />
      </div>
      <div className="flex flex-col justify-center uppercase max-md:mt-fluid-40">
        {globals.productPrefix ? <span className="mb-20 pb-fluid-20 text-center text-[3rem] md:hidden">{globals.productPrefix}</span> : null}
        <ul className="flex justify-center gap-fluid-60 md:mt-fluid-120">
          {sameType.map((p) => (
            <li key={p.id}>
              <TLink href={`/products/${p.slug}`}>
                <LinkLabel text={p.flavorEntry?.data.name} color="var(--text-color)" />
              </TLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
