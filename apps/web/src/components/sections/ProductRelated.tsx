'use client';

import { TLink } from '@/components/nav/TLink';
import { MotionHorizontalScroll } from '@/components/ui/MotionHorizontalScroll';
import { MotionTextChar } from '@/components/ui/MotionTextChar';
import { cx } from '@/lib/cx';
import { useSite } from '@/lib/site';
import { ProductCard } from './ProductCard';

/** Related products: same packaging first, then the lead packaging type (jar) — like the original. */
export function ProductRelated({ slug, className }: { slug: string; className?: string }) {
  const { products, globals } = useSite();
  const current = products.find((p) => p.slug === slug);
  const typeOrder = (p: (typeof products)[number]) => p.typeEntry?.sortOrder ?? 99;
  const leadType = [...products].sort((a, b) => typeOrder(a) - typeOrder(b))[0]?.typeEntry?.id;
  let related: typeof products;
  if (current?.typeEntry?.id === leadType) {
    const same = products.filter((p) => p.typeEntry?.id === leadType && p.slug !== slug);
    const others = products.filter((p) => p.typeEntry?.id !== leadType).sort((a, b) => typeOrder(a) - typeOrder(b));
    const nextType = others[0]?.typeEntry?.id;
    related = [...same, ...others.filter((p) => p.typeEntry?.id === nextType)];
  } else {
    related = [...products.filter((p) => p.typeEntry?.id === current?.typeEntry?.id && p.slug !== slug), ...products.filter((p) => p.typeEntry?.id === leadType)];
  }
  return (
    <section className={cx('relative z-10 flex w-full flex-col items-center justify-center bg-bg pt-fluid-160 text-accent', className)}>
      <MotionTextChar className="mb-fluid-120 text-center text-[length:max(7rem,min(7vw,12rem))] leading-[90%] uppercase" text={globals.relatedProductsTitle} />
      <MotionHorizontalScroll fromCenter>
        {related.map((p) => (
          <TLink key={p.id} href={`/products/${p.slug}`}>
            <ProductCard product={{ image: p.data.image?.url, flavorColor: p.flavorEntry?.data.color, optimizeLegibility: p.flavorEntry?.data.optimizeLegibility }} />
          </TLink>
        ))}
      </MotionHorizontalScroll>
    </section>
  );
}
