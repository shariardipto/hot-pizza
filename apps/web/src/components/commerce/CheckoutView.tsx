'use client';

import { ApiError, type CreateOrderResponse, type PaymentAction } from '@app/shared/api';
import { formatMoney, PAYMENT_PROVIDER_INFO, type Fulfillment, type PaymentMethod } from '@app/shared/commerce';
import { addressFormat, addressLabel, listCountries } from '@app/shared/i18n';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { TLink } from '@/components/nav/TLink';
import { MotionTextChar } from '@/components/ui/MotionTextChar';
import { useCart } from '@/lib/cart';
import { apiErrorText, clientApi, newIdempotencyKey } from '@/lib/client-api';
import { useCountry, useMarket, useQuote } from '@/lib/commerce-hooks';
import { cx } from '@/lib/cx';
import { imgUrl } from '@/lib/img';
import { openRazorpay } from '@/lib/razorpay';
import { useLocalePath, useSite, useT } from '@/lib/site';
import { BotCheck, type BotCheckHandle } from './BotCheck';
import { TotalsTable } from './CartDrawer';
import { CountrySelect } from './CountrySelect';
import { StripePay } from './StripePay';
import { check, choice, choiceHint, choices, ctaChevron, field, fieldError, fieldInput, fieldLabel, fieldTextarea, fieldsRow, fieldset, formError, formGrid, formPage, lineItem, lineItemMedia, lineItemPrice, notice, panelCard, phoneInput } from './ui';

type Errors = Record<string, string>;

function Field({ label, error, children, className }: { label: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx(field(Boolean(error)), className)}>
      <span className={cx(fieldLabel, 'text-20')}>{label}</span>
      {children}
      {error ? (
        <span className={cx(fieldError, 'text-20')} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function CheckoutView() {
  const t = useT();
  const { locale, settings } = useSite();
  const lp = useLocalePath();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [country, setCountry] = useCountry();
  const market = useMarket(country);
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const { quote, loading } = useQuote(items, country, fulfillment, method);
  const [form, setForm] = useState({ name: '', phone: '', email: '', line1: '', line2: '', city: '', region: '', postalCode: '', notes: '', pickup: '', terms: false });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stripe, setStripe] = useState<{ clientSecret: string; publishableKey: string; returnUrl: string } | null>(null);
  const idem = useRef(newIdempotencyKey());
  const bot = useRef<BotCheckHandle>(null);

  const fmt = addressFormat(country);
  const label = (kind: Parameters<typeof addressLabel>[0], fallback: string) => addressLabel(kind, locale) ?? fallback;
  const calling = useMemo(() => listCountries(locale).find((c) => c.code === country)?.callingCode ?? '', [country, locale]);

  const methods = quote?.paymentMethods ?? [];
  useEffect(() => {
    if (method && !methods.includes(method)) setMethod(null);
    if (!method && methods.length) setMethod(methods[0]!);
  }, [methods.join(','), method]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (market && fulfillment === 'delivery' && !market.market.deliveryEnabled && market.market.pickupEnabled) setFulfillment('pickup');
    if (market && fulfillment === 'pickup' && !market.market.pickupEnabled) setFulfillment('delivery');
  }, [market, fulfillment]);

  const set = (k: keyof typeof form) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? Boolean(e.target.checked) : e.target.value }));
  const msg = (code: string) =>
    ({ required: t('errorRequired', 'Required'), phone: t('errorPhone', 'Invalid phone'), email: t('errorEmail', 'Invalid e-mail'), postal: t('errorPostal', 'Invalid postal code') })[code] ??
    t('errorGeneric', 'Invalid');

  function validate(): Errors {
    const e: Errors = {};
    if (form.name.trim().length < 2) e['customer.name'] = 'required';
    if (form.phone.trim().length < 5) e['customer.phone'] = 'phone';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e['customer.email'] = 'email';
    if (method && method !== 'cod' && !form.email) e['customer.email'] = 'required';
    if (fulfillment === 'delivery') {
      if (form.line1.trim().length < 3) e['address.line1'] = 'required';
      if (form.city.trim().length < 2) e['address.city'] = 'required';
      if (fmt.regionRequired && !form.region.trim()) e['address.region'] = 'required';
      if (fmt.postal && fmt.postalRequired && !form.postalCode.trim()) e['address.postalCode'] = 'required';
      else if (form.postalCode && fmt.postalPattern && !fmt.postalPattern.test(form.postalCode.trim())) e['address.postalCode'] = 'postal';
    } else if (!form.pickup) e.pickupLocationId = 'required';
    if (!form.terms) e.acceptTerms = 'required';
    return e;
  }

  async function handlePayment(res: CreateOrderResponse) {
    const action: PaymentAction = res.payment;
    const tracking = `${window.location.origin}${res.trackingPath}`;
    if (action.type === 'none') {
      clear();
      router.push(res.trackingPath);
    } else if (action.type === 'redirect') {
      clear();
      window.location.href = action.url;
    } else if (action.type === 'stripe') {
      clear();
      setStripe({ clientSecret: action.clientSecret, publishableKey: action.publishableKey, returnUrl: tracking });
    } else if (action.type === 'razorpay') {
      clear();
      try {
        const result = await openRazorpay(action, settings.theme.colors.accent);
        const [number, token] = [res.order.number, res.order.token];
        await clientApi.verifyRazorpay(number, token, result);
      } catch {
        /* dismissed or failed — the order page offers "pay again" */
      }
      router.push(res.trackingPath);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length || !method) {
      document.querySelector('.has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      const captchaToken = await bot.current?.token();
      const res = await clientApi.createOrder(
        {
          country,
          locale,
          items,
          customer: { name: form.name, phone: form.phone, email: form.email || undefined },
          fulfillment,
          ...(fulfillment === 'delivery'
            ? { address: { line1: form.line1, line2: form.line2 || undefined, city: form.city, region: form.region || undefined, postalCode: form.postalCode || undefined, country } }
            : { pickupLocationId: form.pickup }),
          paymentMethod: method,
          notes: form.notes || undefined,
          acceptTerms: true,
        },
        idem.current,
        captchaToken,
      );
      await handlePayment(res);
    } catch (err) {
      idem.current = newIdempotencyKey();
      if (err instanceof ApiError && err.details?.length) {
        const fe: Errors = {};
        for (const d of err.details) fe[d.path.join('.')] = d.message;
        setErrors(fe);
      }
      setFormError(apiErrorText(err, t));
    } finally {
      bot.current?.reset();
      setSubmitting(false);
    }
  }

  const err = (k: string) => (errors[k] ? msg(errors[k]!) : undefined);
  const lines = quote?.lines.filter((l) => l.available) ?? [];
  const pickupLocations = market?.pickupLocations ?? [];

  if (!items.length && !stripe) {
    return (
      <main className={formPage}>
        <div className={cx(formGrid(), 'text-center')}>
          <MotionTextChar tag="h1" className="text-110 uppercase" text={t('cart', 'Your order')} />
          <p className="text-35 uppercase" style={{ whiteSpace: 'pre-line' }}>
            {t('cartEmpty', 'Your order is empty.')}
          </p>
          <TLink href="/products" className={cx(ctaChevron, 'uppercase text-35')} style={{ margin: '0 auto' }}>
            <span>{t('continueShopping', 'Continue shopping')}</span>
          </TLink>
        </div>
      </main>
    );
  }

  return (
    <main className={formPage}>
      <div className={formGrid()}>
        <MotionTextChar tag="h1" className="text-110 uppercase text-center mb-fluid-40" text={t('checkout', 'Checkout')} />
      </div>
      <div className={cx(formGrid(true), 'pb-fluid-120')}>
        <section aria-label={t('checkout', 'Checkout')}>
          {stripe ? (
            <fieldset className={fieldset}>
              <legend className="text-35 uppercase">{t('payment', 'Payment')}</legend>
              <StripePay {...stripe} onError={setFormError} />
              {formError ? <p className={cx(formError, 'text-20')}>{formError}</p> : null}
            </fieldset>
          ) : (
            <form onSubmit={submit} noValidate>
              <fieldset className={fieldset}>
                <legend className="text-35 uppercase">{t('deliverTo', 'Deliver to')}</legend>
                <CountrySelect value={country} onChange={setCountry} label={t('deliverTo', 'Deliver to')} required hideLabel />
              </fieldset>

              <fieldset className={fieldset}>
                <legend className="text-35 uppercase">{t('contactDetails', 'Contact details')}</legend>
                <Field label={t('fullName', 'Full name')} error={err('customer.name')}>
                  <input className={fieldInput} value={form.name} onChange={set('name')} autoComplete="name" required />
                </Field>
                <div className={fieldsRow}>
                  <Field label={t('phone', 'Phone number')} error={err('customer.phone')}>
                    <div className={phoneInput}>
                      <span className={fieldInput} aria-hidden="true">
                        {calling}
                      </span>
                      <input className={fieldInput} type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" required />
                    </div>
                  </Field>
                  <Field label={method && method !== 'cod' ? t('email', 'E-mail') : t('emailOptional', 'E-mail (optional)')} error={err('customer.email')}>
                    <input className={fieldInput} type="email" value={form.email} onChange={set('email')} autoComplete="email" />
                  </Field>
                </div>
              </fieldset>

              {market && market.market.deliveryEnabled && market.market.pickupEnabled ? (
                <fieldset className={fieldset}>
                  <legend className="text-35 uppercase">{t('fulfillment', 'How do you want it?')}</legend>
                  <div className={choices}>
                    {(['delivery', 'pickup'] as Fulfillment[]).map((f) => (
                      <label key={f} className={cx(choice(fulfillment === f), 'text-24 uppercase')}>
                        <input type="radio" name="fulfillment" checked={fulfillment === f} onChange={() => setFulfillment(f)} />
                        {f === 'delivery' ? t('delivery', 'Home delivery') : t('pickup', 'Pick up')}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              {fulfillment === 'delivery' ? (
                <fieldset className={fieldset}>
                  <legend className="text-35 uppercase">{t('address', 'Delivery address')}</legend>
                  <Field label={t('addressLine1', 'Street and number')} error={err('address.line1')}>
                    <input className={fieldInput} value={form.line1} onChange={set('line1')} autoComplete="address-line1" required />
                  </Field>
                  <Field label={t('addressLine2', 'Apartment, floor… (optional)')}>
                    <input className={fieldInput} value={form.line2} onChange={set('line2')} autoComplete="address-line2" />
                  </Field>
                  <div className={fieldsRow} style={{ ['--cols' as string]: fmt.postal ? 3 : 2 }}>
                    <Field label={t('city', 'City')} error={err('address.city')}>
                      <input className={fieldInput} value={form.city} onChange={set('city')} autoComplete="address-level2" required />
                    </Field>
                    <Field label={`${label(fmt.region, t('region', 'State / region'))}${fmt.regionRequired ? '' : ' (opt.)'}`} error={err('address.region')}>
                      <input className={fieldInput} value={form.region} onChange={set('region')} autoComplete="address-level1" />
                    </Field>
                    {fmt.postal ? (
                      <Field label={`${label(fmt.postal, t('postalCode', 'Postal code'))}${fmt.postalRequired ? '' : ' (opt.)'}`} error={err('address.postalCode')}>
                        <input className={fieldInput} value={form.postalCode} onChange={set('postalCode')} autoComplete="postal-code" placeholder={fmt.postalExample} />
                      </Field>
                    ) : null}
                  </div>
                </fieldset>
              ) : (
                <fieldset className={fieldset}>
                  <legend className="text-35 uppercase">{t('pickupLocation', 'Pick-up location')}</legend>
                  <div className={choices} style={{ ['--cols' as string]: 1 }}>
                    {pickupLocations.map((l) => (
                      <label key={l.id} className={cx(choice(form.pickup === l.id), 'text-24 uppercase')}>
                        <input type="radio" name="pickup" checked={form.pickup === l.id} onChange={() => setForm((f) => ({ ...f, pickup: l.id }))} />
                        {l.name}
                        <span className={cx(choiceHint, 'text-20')}>
                          {l.addressLine1}, {l.postalCode} {l.city}
                        </span>
                      </label>
                    ))}
                  </div>
                  {err('pickupLocationId') ? <span className={cx(fieldError, 'text-20')}>{err('pickupLocationId')}</span> : null}
                </fieldset>
              )}

              <fieldset className={fieldset}>
                <Field label={t('notes', 'Notes for your order (optional)')}>
                  <textarea className={fieldTextarea} value={form.notes} onChange={set('notes')} maxLength={1000} />
                </Field>
              </fieldset>

              <fieldset className={fieldset}>
                <legend className="text-35 uppercase">{t('payment', 'Payment')}</legend>
                {methods.length ? (
                  <div className={choices} style={{ ['--cols' as string]: Math.min(methods.length, 2) }}>
                    {methods.map((m) => (
                      <label key={m} className={cx(choice(method === m), 'text-24 uppercase')}>
                        <input type="radio" name="payment" checked={method === m} onChange={() => setMethod(m)} />
                        {m === 'cod' ? t('payCod', 'Cash on delivery') : `${t('payOnline', 'Pay online')} — ${PAYMENT_PROVIDER_INFO[m].label}`}
                        <span className={cx(choiceHint, 'text-20')}>
                          {m === 'cod'
                            ? `${t('payCodHint', 'Pay in cash when your order arrives.')}${quote?.market.codFee ? ` +${formatMoney(quote.market.codFee, quote.totals.currency, locale)}` : ''}`
                            : PAYMENT_PROVIDER_INFO[m].description}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className={cx(notice, 'text-20 uppercase')}>{loading ? t('processing', 'Processing…') : quote ? t('paymentUnavailable', 'Payment is not available right now. Please try again later or contact us.') : t('unavailableInRegion', 'Not available in your region')}</p>
                )}
                {quote?.codUnavailableReason === 'limit' ? <p className="text-20">{t('codMax', 'Cash on delivery up to {amount}').replace('{amount}', formatMoney(quote.market.codMaxAmount ?? 0, quote.totals.currency, locale))}</p> : null}
              </fieldset>

              <fieldset className={fieldset}>
                <label className={cx(check, 'text-24', errors.acceptTerms && 'has-error')}>
                  <input type="checkbox" checked={form.terms} onChange={set('terms')} />
                  <span>
                    {t('acceptTerms', 'I accept the terms and the privacy policy')} —{' '}
                    <a href={lp('/legal/privacy-policy')} target="_blank" rel="noopener" style={{ textDecoration: 'underline' }}>
                      ↗
                    </a>
                  </span>
                </label>
                {errors.acceptTerms ? <span className={cx(fieldError, 'text-20')}>{msg('required')}</span> : null}
              </fieldset>

              <BotCheck action="checkout" ref={bot} />
              {quote?.belowMinimum && quote.market.minOrderAmount ? (
                <p className={cx(notice, 'text-20 uppercase')}>{t('minOrder', 'Minimum order {amount}').replace('{amount}', formatMoney(quote.market.minOrderAmount, quote.totals.currency, locale))}</p>
              ) : null}
              {formError ? (
                <p className={cx(formError, 'text-20')} role="alert">
                  {formError}
                </p>
              ) : null}
              <button className={cx(ctaChevron, 'uppercase text-35')} disabled={submitting || !quote || !method || quote.belowMinimum}>
                <span>{submitting ? t('processing', 'Processing…') : method === 'cod' ? t('placeOrder', 'Place order') : t('payNow', 'Pay now')}</span>
              </button>
            </form>
          )}
        </section>

        <aside className={panelCard} aria-label={t('cart', 'Your order')}>
          <p className="text-35 uppercase mb-fluid-20">{t('cart', 'Your order')}</p>
          <ul className="mb-fluid-40">
            {lines.map((l) => (
              <li key={l.productId} className={lineItem()}>
                <div className={lineItemMedia}>{l.image ? <img src={imgUrl(l.image, { width: 200 })} alt="" /> : null}</div>
                <span className="text-24 uppercase">
                  {l.name} × {l.quantity}
                </span>
                <span className={cx(lineItemPrice, 'text-24')}>{quote ? formatMoney(l.lineTotal, quote.totals.currency, locale) : ''}</span>
              </li>
            ))}
          </ul>
          {quote ? <TotalsTable quote={quote} locale={locale} t={t} /> : null}
        </aside>
      </div>
    </main>
  );
}
