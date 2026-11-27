'use client';

import { formatMoney } from '@app/shared/commerce';
import type { ProductOffer } from '@app/shared/content';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart';
import { cx } from '@/lib/cx';
import { useSite, useT } from '@/lib/site';
import { ui } from '@/lib/store';
import { ctaChevron, qty as qtyGroup, qtyButton, qtyValue } from './ui';

/** Price + quantity + "Add to order" — sits under the product specs, in the page's flavor colors. */
export function ProductBuy({ productId, offer }: { productId: string; offer: ProductOffer | null }) {
  const t = useT();
  const { locale, settings } = useSite();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items.find((i) => i.productId === productId)?.quantity ?? 0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const id = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(id);
  }, [added]);

  if (!settings.features.ordering || !offer) return null;
  const max = Math.max(0, offer.maxQuantity - inCart);
  const available = offer.orderable && offer.inStock && offer.price !== null && max > 0;

  return (
    <section className="flex justify-center pt-fluid-60 pb-fluid-120 text-(color:--text-color)" aria-label={t('addToOrder', 'Add to order')}>
      <div className="flex flex-col items-center gap-fluid-40">
        {offer.price !== null ? (
          <p className="flex items-baseline gap-20 text-90 uppercase">
            {offer.compareAtPrice && offer.compareAtPrice > offer.price ? (
              <s className="text-35 opacity-60">{formatMoney(offer.compareAtPrice, offer.currency, locale)}</s>
            ) : null}
            {formatMoney(offer.price, offer.currency, locale)}
          </p>
        ) : null}
        {available ? (
          <div className="flex flex-wrap items-center justify-center gap-fluid-40">
            <div className={cx(qtyGroup, 'text-35')} role="group" aria-label={t('quantity', 'Quantity')}>
              <button className={qtyButton} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="−" disabled={qty <= 1}>
                −
              </button>
              <span className={qtyValue} aria-live="polite">
                {qty}
              </span>
              <button className={qtyButton} onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="+" disabled={qty >= max}>
                +
              </button>
            </div>
            <button
              className={cx(ctaChevron, 'text-35 uppercase', added && 'is-done')}
              onClick={() => {
                add(productId, qty, offer.maxQuantity);
                setAdded(true);
                setQty(1);
                ui().set({ isCartOpen: true });
              }}
            >
              <span>{added ? t('added', 'Added') : t('addToOrder', 'Add to order')}</span>
            </button>
          </div>
        ) : (
          <p className="text-35 uppercase opacity-70">
            {offer.price === null || !offer.orderable ? t('unavailableInRegion', 'Not available in your region') : t('outOfStock', 'Sold out')}
          </p>
        )}
      </div>
    </section>
  );
}
