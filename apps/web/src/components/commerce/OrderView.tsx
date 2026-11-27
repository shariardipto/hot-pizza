'use client';

import { ApiError, type PublicOrder } from '@app/shared/api';
import { formatMoney, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus } from '@app/shared/commerce';
import { countryName } from '@app/shared/i18n';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { MotionTextChar } from '@/components/ui/MotionTextChar';
import { clientApi } from '@/lib/client-api';
import { cx } from '@/lib/cx';
import { imgUrl } from '@/lib/img';
import { openRazorpay } from '@/lib/razorpay';
import { useLocalePath, useSite, useT } from '@/lib/site';
import { StripePay } from './StripePay';
import {
  ctaChevron,
  field,
  fieldInput,
  fieldLabel,
  fieldset,
  formError,
  formGrid,
  formPage,
  lineItem,
  lineItemMedia,
  lineItemPrice,
  notice,
  panelCard,
  statusStep,
  statusSteps,
  totals as totalsTable,
  totalsRow,
} from './ui';

const FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];
const PICKUP_FLOW: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

export function OrderView({ initial, number, token }: { initial: PublicOrder; number: string; token: string }) {
  const t = useT();
  const { locale, settings } = useSite();
  const router = useRouter();
  const [order, setOrder] = useState(initial);
  const [stripe, setStripe] = useState<{ clientSecret: string; publishableKey: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const m = (v: number) => formatMoney(v, order.currency, locale);

  // Poll while an online payment is being confirmed by the provider.
  useEffect(() => {
    if (order.paymentStatus !== 'pending' || order.paymentMethod === 'cod') return;
    const id = window.setInterval(() => {
      clientApi.order(number, token).then(setOrder).catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(id);
  }, [order.paymentStatus, order.paymentMethod, number, token]);

  const canPay = order.status === 'pending' && order.paymentMethod !== 'cod' && (order.paymentStatus === 'failed' || order.paymentStatus === 'pending');

  async function payAgain() {
    setError(null);
    try {
      const res = await clientApi.retryPayment(number, token, order.paymentMethod);
      const a = res.payment;
      if (a.type === 'stripe') setStripe({ clientSecret: a.clientSecret, publishableKey: a.publishableKey });
      else if (a.type === 'redirect') window.location.href = a.url;
      else if (a.type === 'razorpay') {
        const r = await openRazorpay(a, settings.theme.colors.accent);
        setOrder(await clientApi.verifyRazorpay(number, token, r));
      } else router.refresh();
    } catch (e) {
      if (!(e instanceof Error && e.message === 'dismissed')) setError(e instanceof ApiError ? e.message : t('errorGeneric', 'Something went wrong'));
    }
  }

  const flow = order.fulfillment === 'pickup' ? PICKUP_FLOW : FLOW;
  const reached = new Set(order.timeline.map((x) => x.status));
  const currentIdx = flow.indexOf(order.status);
  const cancelled = order.status === 'cancelled' || order.status === 'refunded';

  return (
    <main className={formPage}>
      {/* (No bottom margin: in the original, .form-grid { margin: 0 auto } cancelled sp-80 here.) */}
      <div className={cx(formGrid(), 'text-center')}>
        <MotionTextChar tag="h1" className="text-110 uppercase" text={order.paymentStatus === 'failed' ? t('payment', 'Payment') : t('orderThanks', 'Thank you!')} />
        <p className="text-35 uppercase">{t('orderThanksText', 'We have received your order and will keep you posted.')}</p>
        <p className="text-24 uppercase">
          {t('orderNumber', 'Order number')}: <strong>{order.number}</strong>
        </p>
      </div>
      <div className={cx(formGrid(true), 'pb-fluid-120')}>
        <section className={fieldset}>
          <h2 className="text-35 uppercase">{t('orderStatus', 'Status')}</h2>
          {cancelled ? (
            <p className={cx(notice, 'text-24 uppercase')}>{ORDER_STATUS_LABEL[order.status]}</p>
          ) : (
            <ol className={cx(statusSteps, 'text-24 uppercase')}>
              {flow.map((s, i) => (
                <li key={s} className={statusStep(i <= currentIdx || reached.has(s))}>
                  {ORDER_STATUS_LABEL[s]}
                </li>
              ))}
            </ol>
          )}
          <p className="text-24 uppercase">
            {t('paymentStatus', 'Payment')}: {order.paymentMethod === 'cod' ? t('payCod', 'Cash on delivery') : order.paymentMethod.toUpperCase()} — {PAYMENT_STATUS_LABEL[order.paymentStatus]}
          </p>
          {canPay && !stripe ? (
            <button className={cx(ctaChevron, 'text-35 uppercase')} onClick={payAgain}>
              <span>{t('payNow', 'Pay now')}</span>
            </button>
          ) : null}
          {stripe ? <StripePay {...stripe} returnUrl={window.location.href.split('&payment=')[0]!} onError={setError} /> : null}
          {error ? <p className={cx(formError, 'text-20')}>{error}</p> : null}
          {order.address ? (
            <address className="text-24 uppercase">
              {t('address', 'Delivery address')}:
              <br />
              {order.customerName}
              <br />
              {order.address.line1}
              {order.address.line2 ? `, ${order.address.line2}` : ''}
              <br />
              {[order.address.postalCode, order.address.city, order.address.region].filter(Boolean).join(' ')}
              <br />
              {countryName(order.address.country, locale)}
            </address>
          ) : null}
          {order.pickupLocation ? (
            <p className="text-24 uppercase">
              {t('pickupLocation', 'Pick-up location')}: {order.pickupLocation.name}, {order.pickupLocation.addressLine1}, {order.pickupLocation.city}
            </p>
          ) : null}
        </section>
        <aside className={panelCard}>
          <ul className="mb-fluid-40">
            {order.items.map((i, k) => (
              <li key={k} className={lineItem()}>
                <div className={lineItemMedia}>{i.image ? <img src={imgUrl(i.image, { width: 200 })} alt="" /> : null}</div>
                <span className="text-24 uppercase">
                  {i.name} × {i.quantity}
                </span>
                <span className={cx(lineItemPrice, 'text-24')}>{m(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className={cx(totalsTable, 'text-24 uppercase')}>
            <div className={totalsRow()}>
              <span>{t('subtotal', 'Subtotal')}</span>
              <span>{m(order.subtotal)}</span>
            </div>
            <div className={totalsRow()}>
              <span>{t('shipping', 'Delivery')}</span>
              <span>{order.shipping ? m(order.shipping) : t('freeShipping', 'Free')}</span>
            </div>
            {order.codFee ? (
              <div className={totalsRow()}>
                <span>{t('codFee', 'Cash on delivery fee')}</span>
                <span>{m(order.codFee)}</span>
              </div>
            ) : null}
            {order.tax ? (
              <div className={totalsRow()}>
                <span>
                  {t('tax', 'Tax')}
                  {order.taxInclusive ? ` (${t('taxIncluded', 'incl.')})` : ''}
                </span>
                <span>{m(order.tax)}</span>
              </div>
            ) : null}
            <div className={cx(totalsRow(true), 'text-35')}>
              <span>{t('total', 'Total')}</span>
              <span>{m(order.total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

/** Find an order without an account: order number + phone used at checkout. */
export function OrderLookup() {
  const t = useT();
  const lp = useLocalePath();
  const router = useRouter();
  const [number, setNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await clientApi.lookupOrder(number, phone);
      router.push(lp(`/order/${r.number}?token=${r.token}`));
    } catch {
      setError(t('errorGeneric', 'Order not found'));
    }
  }
  return (
    <main className={formPage}>
      <form className={cx(formGrid(), 'pb-fluid-120')} style={{ maxWidth: '64rem' }} onSubmit={submit}>
        <MotionTextChar tag="h1" className="text-110 uppercase text-center" text={t('trackOrder', 'Track your order')} />
        <label className={field()}>
          <span className={cx(fieldLabel, 'text-20')}>{t('orderNumber', 'Order number')}</span>
          <input className={fieldInput} value={number} onChange={(e) => setNumber(e.target.value)} required placeholder={t('orderNumberPlaceholder', 'PZ-10001')} />
        </label>
        <label className={field()}>
          <span className={cx(fieldLabel, 'text-20')}>{t('phone', 'Phone number')}</span>
          <input className={fieldInput} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        {error ? <p className={cx(formError, 'text-20')}>{error}</p> : null}
        <button className={cx(ctaChevron, 'text-35 uppercase')} style={{ margin: '0 auto' }}>
          <span>{t('trackOrder', 'Track your order')}</span>
        </button>
      </form>
    </main>
  );
}
