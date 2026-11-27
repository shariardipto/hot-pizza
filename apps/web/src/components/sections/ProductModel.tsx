'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import { cx } from '@/lib/cx';
import { imgUrl } from '@/lib/img';

export interface ProductModelHandle {
  /** Kept for the product hero's entrance animation (it slides `el` in; the still image needs no extra step). */
  animateIn: () => void;
  el: HTMLDivElement | null;
}

/** The product image in the hero: a square box the same size as before, holding the cut-out photo. */
export const ProductModel = forwardRef<ProductModelHandle, { poster: string | null; alt?: string; className?: string }>(function ProductModel(
  { poster, alt = '', className },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ animateIn: () => undefined, el: root.current }), []);
  return (
    <div ref={root} className={cx('relative aspect-square w-col-3 md:w-col-4', className)}>
      {poster ? (
        <img className="aspect-square w-col-3 object-contain md:w-col-4" src={imgUrl(poster, { w: 1080 })} alt={alt} width={1080} height={1080} fetchPriority="high" />
      ) : null}
    </div>
  );
});
