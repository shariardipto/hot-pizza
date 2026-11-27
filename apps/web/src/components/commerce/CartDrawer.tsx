'use client';

import { formatMoney } from '@app/shared/commerce';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { LinkLabel } from '@/components/ui/LinkLabel';
import { useCart } from '@/lib/cart';
import { useCountry, useQuote } from '@/lib/commerce-hooks';
import { cx } from '@/lib/cx';
import { imgUrl } from '@/lib/img';
import { lenis } from '@/lib/lenis';
import { beforeNavigate } from '@/lib/navigation';
import { useLocalePath, useSite, useT } from '@/lib/site';
import { ui, useUi } from '@/lib/store';
import { CartFab } from './CartFab';
import { CountrySelect } from './CountrySelect';
import { ctaChevron, lineItem, lineItemMedia, lineItemPrice, notice, qty, qtyButton, qtyValue, totals as totalsTable, totalsRow } from './ui';

/** Side panel padding: gutter × 1.5 horizontally. */
const panelX = 'px-[calc(var(--gutter)*1.5)]';

export function TotalsTable({ quote, locale, t }: { quote: NonNullable<ReturnType<typeof useQuote>['quote']>; locale: string; t: (k: string, f?: string) => string }) {
  const m = (v: number) => formatMoney(v, quote.totals.currency, locale);
  const { totals, market } = quote;
  return (
    <div className={cx(totalsTable, 'text-24 uppercase')}>
      <div className={totalsRow()}>
        <span>{t('subtotal', 'Subtotal')}</span>
        <span>{m(totals.subtotal)}</span>
      </div>
      <div className={totalsRow()}>
        <span>{t('shipping', 'Delivery')}</span>
        <span>{totals.shipping === 0 ? t('freeShipping', 'Free') : m(totals.shipping)}</span>
      </div>
      {totals.codFee ? (
        <div className={totalsRow()}>
          <span>{t('codFee', 'Cash on delivery fee')}</span>
          <span>{m(totals.codFee)}</span>
        </div>
      ) : null}
      {totals.tax ? (
        <div className={totalsRow()}>
          <span>
            {market.taxLabel} {market.taxRate}%{totals.taxInclusive ? ` (${t('taxIncluded', 'incl.')})` : ''}
          </span>
          <span>{m(totals.tax)}</span>
        </div>
      ) : null}
      <div className={cx(totalsRow(true), 'text-35')}>
        <span>{t('total', 'Total')}</span>
        <span>{m(totals.total)}</span>
      </div>
    </div>
  );
}

/** Slide-in cart (menu-style clip-path wipe). Prices and totals always come from the API. */
export function CartDrawer() {
  const t = useT();
  const { locale } = useSite();
  const lp = useLocalePath();
  const router = useRouter();
  const open = useUi((s) => s.isCartOpen);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const [country, setCountry] = useCountry();
  const { quote, loading } = useQuote(open ? items : [], country);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    lenis.stop();
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && ui().set({ isCartOpen: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (!ui().isMenuOpen) lenis.start();
    };
  }, [open]);

  const close = () => ui().set({ isCartOpen: false });
  const goCheckout = () => {
    close();
    const href = lp('/checkout');
    router.prefetch(href);
    window.setTimeout(() => beforeNavigate(href, (h) => router.push(h, { scroll: false })), 300);
  };

  const lines = quote?.lines ?? [];
  const hasItems = items.length > 0;
  const canCheckout = Boolean(quote && lines.some((l) => l.available) && !quote.belowMinimum);

  return (
    <>
      <CartFab />
      <div className={cx('fixed inset-0 z-35', open ? '[pointer-events:all]' : 'pointer-events-none')} aria-hidden={!open} inert={!open}>
        <div className={cx('absolute inset-0 bg-[rgba(0,0,0,0.35)] [transition:opacity_0.8s_var(--ease-expo)]', open ? 'opacity-100' : 'opacity-0')} onClick={close} />
        {/* Panel slides in with a clip-path wipe (like the menu) */}
        <div
          className={cx(
            'absolute top-0 right-0 flex h-dvh w-[min(64rem,100vw)] max-w-[100vw] flex-col bg-accent text-secondary [transition:clip-path_1.2s_var(--ease-in-out-expo)]',
            open ? '[clip-path:inset(0_0_0_0)]' : '[clip-path:inset(0_0_0_100%)]',
          )}
          role="dialog" aria-modal="true" aria-label={t('cart', 'Your order')} data-lenis-prevent="">
          <div className={cx('flex items-center justify-between border-b border-b-secondary py-gutter uppercase', panelX)}>
            <span className="text-90">{t('cart', 'Your order')}</span>
            <button ref={closeBtn} className="cursor-pointer focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-4 text-24 uppercase" onClick={close}>
              <LinkLabel text={t('menuClose', 'Close')} />
            </button>
          </div>
          <div className={cx('flex-1 overflow-y-auto overscroll-contain py-gutter', panelX)}>
            {!hasItems ? (
              <div className="flex min-h-[50vh] flex-col items-center justify-center gap-gutter-double text-center text-35 whitespace-pre-line uppercase">
                <p>{t('cartEmpty', 'Your order is empty.')}</p>
                <button className={cx(ctaChevron, 'text-24 uppercase')} style={{ ['--cta-bg' as string]: 'var(--c-bg)', ['--cta-color' as string]: 'var(--c-accent)' }} onClick={close}>
                  <span>{t('continueShopping', 'Continue shopping')}</span>
                </button>
              </div>
            ) : (
              <>
                <CountrySelect className="mb-fluid-40" id="cart-country" value={country} onChange={setCountry} label={t('deliverTo', 'Deliver to')} />
                <ul aria-busy={loading}>
                  {items.map((it) => {
                    const l = lines.find((x) => x.productId === it.productId);
                    return (
                      <li key={it.productId} className={lineItem(Boolean(l && !l.available))}>
                        <div className={lineItemMedia}>{l?.image ? <img src={imgUrl(l.image, { width: 200 })} alt="" /> : null}</div>
                        <div>
                          <span className="mb-8 block text-24 uppercase">{l?.name ?? '…'}</span>
                          {l && !l.available ? (
                            <span className="text-20">{t('unavailableInRegion', 'Not available in your region')}</span>
                          ) : (
                            <div className="flex items-center gap-16 text-24">
                              <div className={qty} role="group" aria-label={t('quantity', 'Quantity')}>
                                <button className={qtyButton} aria-label="−" onClick={() => setQty(it.productId, it.quantity - 1)}>
                                  −
                                </button>
                                <span className={qtyValue}>{it.quantity}</span>
                                <button className={qtyButton} aria-label="+" disabled={l ? it.quantity >= l.maxQuantity : false} onClick={() => setQty(it.productId, it.quantity + 1, l?.maxQuantity)}>
                                  +
                                </button>
                              </div>
                              <button className="cursor-pointer text-20 uppercase opacity-70 [text-decoration:underline] underline-offset-[0.2em]" onClick={() => remove(it.productId)}>
                                {t('remove', 'Remove')}
                              </button>
                            </div>
                          )}
                        </div>
                        <span className={cx(lineItemPrice, 'text-24')}>{l?.available && quote ? formatMoney(l.lineTotal, quote.totals.currency, locale) : ''}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          {hasItems && quote ? (
            <div className={cx('flex flex-col gap-gutter border-t border-t-secondary pt-gutter pb-[calc(var(--gutter)*1.5)]', panelX)}>
              <TotalsTable quote={quote} locale={locale} t={t} />
              {quote.market.freeShippingThreshold !== null && quote.totals.shipping > 0 ? (
                <p className="text-20 uppercase">
                  {t('freeShippingFrom', 'Free delivery from {amount}').replace('{amount}', formatMoney(quote.market.freeShippingThreshold, quote.totals.currency, locale))}
                </p>
              ) : null}
              {quote.belowMinimum && quote.market.minOrderAmount ? (
                <p className={cx(notice, 'text-20 uppercase')}>{t('minOrder', 'Minimum order {amount}').replace('{amount}', formatMoney(quote.market.minOrderAmount, quote.totals.currency, locale))}</p>
              ) : null}
              <button
                className={cx(ctaChevron, 'text-35 uppercase')}
                style={{ ['--cta-bg' as string]: 'var(--c-bg)', ['--cta-color' as string]: 'var(--c-accent)' }}
                disabled={!canCheckout}
                onClick={goCheckout}
              >
                <span>{t('checkout', 'Checkout')}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
