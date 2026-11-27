'use client';

import type { CSSProperties } from 'react';
import { Media } from '@/components/ui/Media';
import { cx } from '@/lib/cx';
import { useSite } from '@/lib/site';

export interface CardProduct {
  image: string | null | undefined;
  title?: string | null;
  flavorColor?: string | null;
  optimizeLegibility?: boolean | null;
}

const marqueeLine = 'flex justify-center text-center whitespace-nowrap';

/** Product cut-out on a card; hovering reveals a scrolling marquee in the flavor color. */
export function ProductCard({ product, isGeneric = false, className }: { product: CardProduct; isGeneric?: boolean; className?: string }) {
  const { globals } = useSite();
  const block = (k: number) => (
    <div key={k} className="text-center">
      <span className={cx(marqueeLine, 'uppercase text-35')}>{globals.discover}</span>
      <span className={cx(marqueeLine, 'text-110')}>{globals.productWordTop}</span>
      <span className={cx(marqueeLine, 'uppercase text-35')}>{product.title}</span>
      <span className={cx(marqueeLine, 'text-110')}>{globals.productWordBottom}</span>
    </div>
  );
  return (
    <div
      className={cx(
        'group/card relative flex aspect-580/660 w-col-3 cursor-pointer items-center justify-center overflow-hidden text-accent',
        'max-md:w-[calc(var(--col-4)_-_var(--gutter-double)_-_var(--gutter-double))]',
        className,
      )}
      data-cursor-text={globals.discover ?? 'Discover'}
    >
      <Media
        className={cx(
          'z-15 flex aspect-square max-h-[80%] w-[80%] will-change-transform [transition:transform_1.25s_var(--ease-expo)]',
          isGeneric ? 'pointer-fine:group-hover/card:transform-[scale(1.1)]' : 'pointer-fine:group-hover/card:transform-[scale(1.1)_rotate(-4deg)]',
        )}
        image={product.image}
      />
      {/* Marquee: hidden behind a rounded clip, revealed on hover */}
      <div
        className={cx(
          'pointer-events-none absolute top-0 left-0 flex h-full w-full flex-col items-center justify-start uppercase select-none',
          'will-change-[clip-path] [clip-path:inset(0_round_var(--radius))] [transition:clip-path_1s_var(--ease-expo)]',
          'pointer-fine:group-hover/card:opacity-100 pointer-fine:group-hover/card:[clip-path:inset(4%_round_var(--radius))]',
        )}
        style={{ backgroundColor: isGeneric ? 'var(--c-secondary)' : (product.flavorColor ?? undefined), color: product.optimizeLegibility ? 'var(--c-secondary)' : undefined } as CSSProperties}
      >
        <div className="flex animate-marquee flex-col opacity-0 will-change-[opacity,transform] [transition:opacity_0.5s_var(--ease-expo)] pointer-fine:group-hover/card:opacity-100">
          {[0, 1, 2, 3, 4, 5].map(block)}
        </div>
      </div>
      <div />
    </div>
  );
}
