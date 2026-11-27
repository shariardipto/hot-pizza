'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Eraser, Save, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cspOriginSchema, type CommerceSettings, type Features, type SecuritySettings, type Site } from '@app/shared/theme';
import { ImageInput } from '@/components/media-picker';
import { Badge, Button, Card, Field, Input, Loading, PageHeader, Select, Switch, Textarea } from '@/components/ui';
import { errorMessage, get, post, qs } from '@/lib/api';
import { useMe } from '@/lib/me';
import { useSaveSetting, useSettings } from '@/lib/settings';

const lines = (v: string) =>
  v
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

function SecurityCard({ initial }: { initial: SecuritySettings }) {
  const { me } = useMe();
  const save = useSaveSetting('security');
  const [s, setS] = useState(initial);
  const [origins, setOrigins] = useState(initial.cspAllowedOrigins.join('\n'));
  useEffect(() => {
    setS(initial);
    setOrigins(initial.cspAllowedOrigins.join('\n'));
  }, [initial]);
  const { data: status } = useQuery({
    queryKey: ['security-status'],
    queryFn: () => get<{ captcha: { provider: string; configured: boolean }; users: number; withTwoFactor: number }>('/security/status'),
  });
  const badOrigins = lines(origins).filter((o) => !cspOriginSchema.safeParse(o).success);

  return (
    <Card
      title="Security"
      description="Protection for the dashboard and the public forms."
      actions={
        <Button size="sm" disabled={badOrigins.length > 0} onClick={() => save.mutate({ ...s, cspAllowedOrigins: lines(origins) })} loading={save.isPending}>
          <Save className="size-4" /> Save
        </Button>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-1">
          <Switch
            checked={s.requireTwoFactor}
            onChange={(v) => setS({ ...s, requireTwoFactor: v })}
            disabled={!me.user.twoFactorEnabled && !s.requireTwoFactor}
            label="Require two-factor for the whole team"
            description="Members without an authenticator app are sent to set one up before they can use the dashboard."
          />
          <p className="pl-12 text-xs text-zinc-500">
            {status ? `${status.withTwoFactor} of ${status.users} active members use two-factor. ` : ''}
            {!me.user.twoFactorEnabled ? (
              <>
                <Link href="/account" className="text-brand underline">
                  Set it up for your account
                </Link>{' '}
                first.
              </>
            ) : null}
          </p>
        </div>
        <div className="space-y-1">
          <Switch
            checked={s.captcha}
            onChange={(v) => setS({ ...s, captcha: v })}
            label="Bot check on checkout & bookings"
            description="Cloudflare Turnstile — invisible for most visitors, no cookies, no puzzles."
          />
          <p className="pl-12 text-xs">
            {status?.captcha.configured ? (
              <Badge color="green">keys configured</Badge>
            ) : (
              <span className="text-amber-700">Not active: set TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY in the API environment.</span>
            )}
          </p>
        </div>
        <Field
          label="Content-Security-Policy (website)"
          hint="Blocks scripts that were not loaded by the site itself — the main defence against injected code. Use “report only” to test a new analytics tool first."
        >
          <Select value={s.cspMode} onChange={(e) => setS({ ...s, cspMode: e.target.value as SecuritySettings['cspMode'] })}>
            <option value="enforce">Enforce (recommended)</option>
            <option value="report-only">Report only — log violations, block nothing</option>
            <option value="off">Off</option>
          </Select>
        </Field>
        <Field
          label="Allowed third-party origins"
          hint="One per line, e.g. https://www.googletagmanager.com or https://*.google-analytics.com — needed for analytics or embeds you add. Payment gateways are allowed automatically."
          error={badOrigins.length ? `Not a valid https origin: ${badOrigins.join(', ')}` : null}
        >
          <Textarea className="font-mono text-xs" rows={4} value={origins} onChange={(e) => setOrigins(e.target.value)} placeholder="https://www.googletagmanager.com" />
        </Field>
        <Field
          label="Keep customer details for"
          hint="After this, names, phone numbers, e-mails and addresses are removed from finished orders and past bookings. Totals and items stay for your accounts."
        >
          <Select value={s.customerDataRetentionMonths} onChange={(e) => setS({ ...s, customerDataRetentionMonths: Number(e.target.value) })}>
            {[...new Set([0, 12, 24, 36, 60, 72, 120, s.customerDataRetentionMonths])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>
                {m === 0 ? 'Keep (no automatic removal)' : m % 12 === 0 ? `${m / 12} year${m === 12 ? '' : 's'}` : `${m} months`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Keep IP addresses for" hint="IP addresses and browser details are stored with orders and bookings for fraud checks, then deleted.">
          <Select value={s.ipRetentionDays} onChange={(e) => setS({ ...s, ipRetentionDays: Number(e.target.value) })}>
            {[...new Set([30, 60, 90, 180, 365, s.ipRetentionDays])].sort((a, b) => a - b).map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Card>
  );
}

type CustomerData = {
  orders: { number: string; createdAt: string; status: string; anonymized: boolean }[];
  reservations: { code: string; date: string; status: string; anonymized: boolean }[];
};

/** Right of access / right to erasure: find what is stored about a customer, download it, or remove it. */
function CustomerDataCard() {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<{ q: string; data: CustomerData } | null>(null);
  const find = useMutation({
    mutationFn: (query: string) => get<CustomerData>(`/privacy/customer${qs({ q: query })}`),
    onSuccess: (data, query) => setFound({ q: query, data }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const erase = useMutation({
    mutationFn: (query: string) => post<{ orders: number; reservations: number }>('/privacy/customer/erase', { q: query }),
    onSuccess: (r, query) => {
      toast.success(`Personal data removed from ${r.orders} order(s) and ${r.reservations} booking(s)`);
      find.mutate(query);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  async function download(query: string) {
    const res = await fetch(`/api/v1/admin/privacy/customer/export${qs({ q: query })}`, { credentials: 'include' });
    if (!res.ok) return toast.error('Download failed');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const total = found ? found.data.orders.length + found.data.reservations.length : 0;
  const remaining = found ? [...found.data.orders, ...found.data.reservations].filter((x) => !x.anonymized).length : 0;

  return (
    <Card title="Customer data requests" description="When a customer asks what you store about them, or asks you to delete it (GDPR and similar laws).">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) find.mutate(q.trim());
        }}
      >
        <Input className="min-w-64 flex-1" placeholder="Phone number or e-mail address" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button type="submit" variant="secondary" loading={find.isPending}>
          <Search className="size-4" /> Find
        </Button>
      </form>
      {found ? (
        <div className="mt-4 space-y-3 text-sm">
          {total === 0 ? (
            <p className="text-zinc-500">Nothing stored for “{found.q}”.</p>
          ) : (
            <>
              <p>
                {found.data.orders.length} order(s){found.data.orders.length ? `: ${found.data.orders.map((o) => o.number + (o.anonymized ? ' (removed)' : '')).join(', ')}` : ''}
                <br />
                {found.data.reservations.length} booking(s){found.data.reservations.length ? `: ${found.data.reservations.map((r) => r.code + (r.anonymized ? ' (removed)' : '')).join(', ')}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => download(found.q)}>
                  <Download className="size-4" /> Download their data (JSON)
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={remaining === 0}
                  loading={erase.isPending}
                  onClick={() => window.confirm(`Remove the name, phone, e-mail and address from ${remaining} order(s)/booking(s)? This cannot be undone.`) && erase.mutate(found.q)}
                >
                  <Eraser className="size-4" /> Erase personal data
                </Button>
              </div>
              <p className="text-xs text-zinc-500">Open orders and upcoming bookings must be finished or cancelled first. Totals and items are kept for your accounts.</p>
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}

export default function SettingsPage() {
  const { data, isLoading } = useSettings();
  const saveSite = useSaveSetting('site');
  const saveFeatures = useSaveSetting('features');
  const saveCommerce = useSaveSetting('commerce');
  const [site, setSite] = useState<Site | null>(null);
  const [features, setFeatures] = useState<Features | null>(null);
  const [commerce, setCommerce] = useState<CommerceSettings | null>(null);
  const [blocked, setBlocked] = useState('');
  useEffect(() => {
    if (!data) return;
    setSite(data.site);
    setFeatures(data.features);
    setCommerce(data.commerce);
    setBlocked(data.commerce.blockedCustomers.join('\n'));
  }, [data]);
  if (isLoading || !site || !features || !commerce || !data) return <Loading />;
  const timezones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];

  return (
    <>
      <PageHeader title="Settings" description="Site identity, features, order rules and security." />
      <div className="space-y-5">
        <Card
          title="Site"
          actions={
            <Button size="sm" onClick={() => saveSite.mutate(site)} loading={saveSite.isPending}>
              <Save className="size-4" /> Save
            </Button>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Site name">
              <Input value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} />
            </Field>
            <Field label="Page title suffix" hint="Pages without an SEO title use “Title — suffix”.">
              <Input value={site.titleSuffix} onChange={(e) => setSite({ ...site, titleSuffix: e.target.value })} />
            </Field>
            <Field label="Public website URL" hint="Used for links in e-mails, sitemap and canonical URLs. Empty = the WEB_URL set on the server.">
              <Input value={site.url} onChange={(e) => setSite({ ...site, url: e.target.value })} placeholder="https://www.example.com" />
            </Field>
            <Field label="Time zone">
              <Input list="tz" value={site.timezone} onChange={(e) => setSite({ ...site, timezone: e.target.value })} />
              <datalist id="tz">
                {timezones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </Field>
            <Field label="Notification e-mail" hint="Receives new orders and bookings.">
              <Input type="email" value={site.notificationEmail} onChange={(e) => setSite({ ...site, notificationEmail: e.target.value })} />
            </Field>
            <Field label="Default description (SEO)" className="md:col-span-2">
              <Textarea value={site.defaultDescription} onChange={(e) => setSite({ ...site, defaultDescription: e.target.value })} />
            </Field>
            <Field label="Default share image" className="md:col-span-2">
              <ImageInput value={site.defaultShareImage} onChange={(v) => setSite({ ...site, defaultShareImage: v })} />
            </Field>
            <Field label="Analytics / tag manager snippet" hint="Inline JavaScript injected in <head>. Remember the cookie consent rules of your markets." className="md:col-span-2">
              <Textarea className="font-mono text-xs" value={site.analyticsHead} onChange={(e) => setSite({ ...site, analyticsHead: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card
          title="Features"
          actions={
            <Button size="sm" onClick={() => saveFeatures.mutate(features)} loading={saveFeatures.isPending}>
              <Save className="size-4" /> Save
            </Button>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Switch checked={features.ordering} onChange={(v) => setFeatures({ ...features, ordering: v })} label="Online ordering" description="Add-to-order, cart, checkout and order tracking." />
            <Switch checked={features.reservations} onChange={(v) => setFeatures({ ...features, reservations: v })} label="Table reservations" description="Booking page, menu link and home banner." />
            <Switch checked={features.locationsPage} onChange={(v) => setFeatures({ ...features, locationsPage: v })} label="“Our locations” page" description="Lists your branches from Locations (address, opening hours, phone)." />
            <Switch checked={features.languageSwitcher} onChange={(v) => setFeatures({ ...features, languageSwitcher: v })} label="Language switcher" />
            <Switch checked={features.geoDetection} onChange={(v) => setFeatures({ ...features, geoDetection: v })} label="Detect visitor country" description="Pre-selects the market (currency, payment methods) from CDN/IP headers and browser language." />
          </div>
        </Card>

        <Card
          title="Orders & reservations"
          actions={
            <Button size="sm" onClick={() => saveCommerce.mutate({ ...commerce, blockedCustomers: lines(blocked) })} loading={saveCommerce.isPending}>
              <Save className="size-4" /> Save
            </Button>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Order number prefix" hint={`Orders look like ${commerce.orderPrefix ? `${commerce.orderPrefix}-` : ''}10001`}>
              <Input value={commerce.orderPrefix} maxLength={6} onChange={(e) => setCommerce({ ...commerce, orderPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
            </Field>
            <Field label="Reservation code prefix">
              <Input value={commerce.reservationPrefix} maxLength={6} onChange={(e) => setCommerce({ ...commerce, reservationPrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} />
            </Field>
            <Field label="Unpaid online orders expire after (minutes)" hint="Stock is returned and the order cancelled.">
              <Input type="number" min={10} max={1440} value={commerce.unpaidOrderTimeoutMinutes} onChange={(e) => setCommerce({ ...commerce, unpaidOrderTimeoutMinutes: Number(e.target.value) })} />
            </Field>
            <Switch checked={commerce.requireEmailForOnlinePayment} onChange={(v) => setCommerce({ ...commerce, requireEmailForOnlinePayment: v })} label="Require e-mail for online payments" description="E-mail stays optional for cash on delivery." />
            <Switch checked={commerce.emailCustomerOnStatusChange} onChange={(v) => setCommerce({ ...commerce, emailCustomerOnStatusChange: v })} label="E-mail customers when their order status changes" />
          </div>
          <h3 className="mt-6 mb-3 text-sm font-semibold text-zinc-900">Fraud protection</h3>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Max open cash-on-delivery orders per phone" hint="Further COD orders are refused until earlier ones are delivered or cancelled. 0 = no limit.">
              <Input type="number" min={0} max={50} value={commerce.codMaxOpenOrdersPerPhone} onChange={(e) => setCommerce({ ...commerce, codMaxOpenOrdersPerPhone: Number(e.target.value) })} />
            </Field>
            <Field label="Max upcoming reservations per phone" hint="0 = no limit. Bookings entered by staff are not limited.">
              <Input type="number" min={0} max={50} value={commerce.maxUpcomingReservationsPerPhone} onChange={(e) => setCommerce({ ...commerce, maxUpcomingReservationsPerPhone: Number(e.target.value) })} />
            </Field>
            <Field
              label="Blocked customers"
              hint="One phone number (any format, with or without country code) or e-mail per line. They see a neutral “please contact us” message."
              className="md:col-span-2"
            >
              <Textarea
                className="font-mono text-xs"
                rows={4}
                value={blocked}
                onChange={(e) => setBlocked(e.target.value)}
                placeholder={'+8801712345678\nfake@example.com'}
              />
            </Field>
          </div>
        </Card>

        <SecurityCard initial={data.security} />
        <CustomerDataCard />
      </div>
    </>
  );
}
