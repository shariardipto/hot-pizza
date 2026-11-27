'use client';

import { ApiError, type AvailabilityResponse, type CreateReservationResponse, type PublicLocation, type PublicReservation } from '@app/shared/api';
import { RESERVATION_STATUS_LABEL } from '@app/shared/commerce';
import { formatPhone } from '@app/shared/schemas';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Footer } from '@/components/layout/Footer';
import { TLink } from '@/components/nav/TLink';
import { MotionTextChar } from '@/components/ui/MotionTextChar';
import { TextBlock } from '@/components/ui/TextBlock';
import { TitleLarge } from '@/components/ui/TitleLarge';
import { apiErrorText, clientApi, newIdempotencyKey } from '@/lib/client-api';
import { BotCheck, type BotCheckHandle } from './BotCheck';
import { useCountry } from '@/lib/commerce-hooks';
import { cx } from '@/lib/cx';
import { useSite, useT } from '@/lib/site';
import { CountrySelect } from './CountrySelect';
import { ctaChevron, field, fieldError, fieldInput, fieldLabel, fieldSelect, fieldTextarea, fieldsRow, fieldset, formError, formGrid, formPage, notice, panelCard, slot, slots } from './ui';

function localToday(tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(d: string, n: number) {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
}

export function ReservationView({ locations }: { locations: PublicLocation[] }) {
  const t = useT();
  const { locale } = useSite();
  const [visitorCountry] = useCountry();
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const loc = locations.find((l) => l.id === locationId);
  const today = loc ? localToday(loc.timezone) : new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [partySize, setPartySize] = useState(2);
  const [time, setTime] = useState('');
  const [avail, setAvail] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [phoneCountry, setPhoneCountry] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<CreateReservationResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const bot = useRef<BotCheckHandle>(null);
  const idem = useRef(newIdempotencyKey());

  useEffect(() => {
    if (!phoneCountry) setPhoneCountry(visitorCountry || loc?.country || '');
  }, [visitorCountry, loc, phoneCountry]);

  useEffect(() => {
    if (!locationId || !date) return;
    let alive = true;
    setLoading(true);
    setTime('');
    clientApi
      .availability(locationId, date, partySize)
      .then((a) => alive && setAvail(a))
      .catch(() => alive && setAvail(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [locationId, date, partySize]);

  const sizes = useMemo(() => {
    const min = loc?.minPartySize ?? 1;
    const max = loc?.maxPartySize ?? 12;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [loc]);

  const msg = (code: string) =>
    ({ required: t('errorRequired', 'Required'), phone: t('errorPhone', 'Invalid phone'), email: t('errorEmail', 'Invalid e-mail') })[code] ?? t('errorGeneric', 'Invalid');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const v: Record<string, string> = {};
    if (!time) v.time = 'required';
    if (form.name.trim().length < 2) v.name = 'required';
    if (form.phone.trim().length < 5) v.phone = 'phone';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) v.email = 'email';
    setErrors(v);
    if (Object.keys(v).length) return;
    setSubmitting(true);
    try {
      const captchaToken = await bot.current?.token();
      const res = await clientApi.createReservation(
        { locationId, date, time, partySize, name: form.name, phone: form.phone, phoneCountry: phoneCountry || 'ES', email: form.email || undefined, notes: form.notes || undefined, locale },
        idem.current,
        captchaToken,
      );
      setDone(res);
    } catch (err) {
      idem.current = newIdempotencyKey();
      if (err instanceof ApiError && err.details) setErrors(Object.fromEntries(err.details.map((d) => [d.path.join('.'), d.message])));
      setFormError(apiErrorText(err, t));
      if (err instanceof ApiError && err.code === 'slot_full') setDate((d) => d); // refresh slots
    } finally {
      bot.current?.reset();
      setSubmitting(false);
    }
  }

  const dateLabel = (d: string) => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
    } catch {
      return d;
    }
  };

  if (!locations.length) {
    return (
      <main className={formPage}>
        <p className={cx(formGrid(), 'text-35 uppercase text-center pb-fluid-120')}>{t('reservationNoSlots', 'Reservations are not available.')}</p>
        <Footer />
      </main>
    );
  }

  return (
    <main className={formPage}>
      <TitleLarge className="mb-fluid-40" title={t('reservationTitle', 'BOOK\nA TABLE')} titleSmallLeft={null} titleSmallRight={null} tag="h1" />
      <TextBlock className="mb-fluid-80" text={t('reservationIntro', '')} xsmall />
      {done ? (
        <section className={cx(formGrid(), 'text-center pb-fluid-120')} aria-live="polite">
          <MotionTextChar tag="h2" className="text-110 uppercase" text={t('reservationThanks', 'See you soon!')} />
          <p className="text-35 uppercase">{t('reservationThanksText', '')}</p>
          <p className="text-24 uppercase">
            {done.reservation.code} · {dateLabel(done.reservation.date)} · {done.reservation.time} · {done.reservation.partySize} {t('reservationGuests', 'Guests')}
          </p>
          <TLink href={done.managePath} localized={false} className={cx(ctaChevron, 'uppercase text-35')} style={{ margin: '0 auto' }}>
            <span>{t('reservationCancel', 'Manage reservation')}</span>
          </TLink>
        </section>
      ) : (
        <form className={cx(formGrid(true), 'pb-fluid-120')} onSubmit={submit} noValidate>
          <section>
            <fieldset className={fieldset}>
              {locations.length > 1 ? (
                <label className={field()}>
                  <span className={cx(fieldLabel, 'text-20')}>{t('reservationLocation', 'Location')}</span>
                  <select className={fieldSelect} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} — {l.city}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className={fieldsRow}>
                <label className={field()}>
                  <span className={cx(fieldLabel, 'text-20')}>{t('reservationDate', 'Date')}</span>
                  <input className={fieldInput} type="date" value={date} min={today} max={addDays(today, loc?.maxAdvanceDays ?? 60)} onChange={(e) => setDate(e.target.value)} required />
                </label>
                <label className={field()}>
                  <span className={cx(fieldLabel, 'text-20')}>{t('reservationGuests', 'Guests')}</span>
                  <select className={fieldSelect} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))}>
                    {sizes.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={field(Boolean(errors.time))}>
                <span className={cx(fieldLabel, 'text-20')}>
                  {t('reservationTime', 'Time')} — {dateLabel(date)}
                </span>
                {loading ? (
                  <p className="text-24 uppercase">{t('loading', 'Loading')}…</p>
                ) : avail && !avail.closed && avail.slots.some((s) => s.available) ? (
                  <div className={cx(slots, 'text-24')} role="radiogroup" aria-label={t('reservationTime', 'Time')}>
                    {avail.slots.map((s) => (
                      <button key={s.time} type="button" role="radio" aria-checked={time === s.time} className={slot(time === s.time)} disabled={!s.available} onClick={() => setTime(s.time)}>
                        {s.time}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={cx(notice, 'text-20 uppercase')}>{t('reservationNoSlots', 'No tables available on this day.')}</p>
                )}
                {errors.time ? <span className={cx(fieldError, 'text-20')}>{msg('required')}</span> : null}
              </div>
            </fieldset>
            <fieldset className={fieldset}>
              <legend className="text-35 uppercase">{t('contactDetails', 'Contact details')}</legend>
              <label className={field(Boolean(errors.name))}>
                <span className={cx(fieldLabel, 'text-20')}>{t('fullName', 'Full name')}</span>
                <input className={fieldInput} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required />
                {errors.name ? <span className={cx(fieldError, 'text-20')}>{msg(errors.name)}</span> : null}
              </label>
              <div className={fieldsRow}>
                <CountrySelect value={phoneCountry} onChange={setPhoneCountry} label={t('reservationPhoneCountry', 'Country code')} id="phone-country" />
                <label className={field(Boolean(errors.phone))}>
                  <span className={cx(fieldLabel, 'text-20')}>{t('phone', 'Phone number')}</span>
                  <input className={fieldInput} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" required />
                  {errors.phone ? <span className={cx(fieldError, 'text-20')}>{msg(errors.phone)}</span> : null}
                </label>
              </div>
              <label className={field(Boolean(errors.email))}>
                <span className={cx(fieldLabel, 'text-20')}>{t('emailOptional', 'E-mail (optional)')}</span>
                <input className={fieldInput} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
                {errors.email ? <span className={cx(fieldError, 'text-20')}>{msg(errors.email)}</span> : null}
              </label>
              <label className={field()}>
                <span className={cx(fieldLabel, 'text-20')}>{t('reservationNotes', 'Notes for your booking (optional)')}</span>
                <textarea className={fieldTextarea} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} />
              </label>
            </fieldset>
            <BotCheck action="reservation" ref={bot} />
            {formError ? (
              <p className={cx(formError, 'text-20')} role="alert">
                {formError}
              </p>
            ) : null}
            <button className={cx(ctaChevron, 'uppercase text-35')} disabled={submitting}>
              <span>{submitting ? t('processing', 'Processing…') : t('reservationSubmit', 'Book a table')}</span>
            </button>
          </section>
          {loc ? (
            <aside className={cx(panelCard, 'text-24 uppercase')}>
              <p className="text-35 mb-fluid-20">{loc.name}</p>
              <p className="mb-fluid-20">
                {loc.addressLine1}
                <br />
                {loc.postalCode} {loc.city}
              </p>
              {loc.phone ? <p>{formatPhone(loc.phone)}</p> : null}
            </aside>
          ) : null}
        </form>
      )}
      <Footer />
    </main>
  );
}

export function ReservationManage({ initial, code, token }: { initial: PublicReservation; code: string; token: string }) {
  const t = useT();
  const { locale } = useSite();
  const [r, setR] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${r.date}T00:00:00Z`));
  return (
    <main className={formPage}>
      <section className={cx(formGrid(), 'text-center pb-fluid-120')}>
        <MotionTextChar tag="h1" className="text-110 uppercase" text={r.status === 'cancelled' ? t('reservationCancelled', 'Cancelled') : t('reservationThanks', 'See you soon!')} />
        <p className="text-35 uppercase">
          {r.code} — {RESERVATION_STATUS_LABEL[r.status]}
        </p>
        <p className="text-24 uppercase">
          {date} · {r.time} · {r.partySize} {t('reservationGuests', 'Guests')}
          <br />
          {r.location.name}, {r.location.addressLine1}, {r.location.city}
        </p>
        {r.canCancel ? (
          <button
            className={cx(ctaChevron, 'uppercase text-35')}
            style={{ margin: '0 auto' }}
            disabled={busy}
            onClick={async () => {
              if (!window.confirm(`${t('reservationCancel', 'Cancel reservation')}?`)) return;
              setBusy(true);
              try {
                setR(await clientApi.cancelReservation(code, token));
              } catch (e) {
                setError(e instanceof Error ? e.message : t('errorGeneric', 'Something went wrong'));
              } finally {
                setBusy(false);
              }
            }}
          >
            <span>{t('reservationCancel', 'Cancel reservation')}</span>
          </button>
        ) : null}
        {error ? <p className={cx(formError, 'text-20')}>{error}</p> : null}
      </section>
    </main>
  );
}
