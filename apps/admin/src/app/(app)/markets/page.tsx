'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Copy, Plus, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PAYMENT_PROVIDERS, providerSupportsCurrency, type PaymentProvider } from '@app/shared/commerce';
import { listCountries } from '@app/shared/i18n';
import { Badge, Button, Card, Field, Input, Loading, Modal, PageHeader, Select, Switch } from '@/components/ui';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { fromMinorInput, money, toMinorInput } from '@/lib/utils';

const PROVIDER_CHOICE: Record<PaymentProvider, string> = {
  stripe: 'Stripe (cards, Apple/Google Pay)',
  paypal: 'PayPal (PayPal balance, Pay Later, cards)',
  razorpay: 'Razorpay (UPI, cards — India)',
  sslcommerz: 'SSLCommerz (bKash, Nagad, cards — Bangladesh)',
};

interface MarketRow {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
  currency: string;
  countries: string[];
  isDefault: boolean;
  isFallback: boolean;
  exchangeRate: number;
  rounding: 'none' | 'whole' | 'x99';
  taxRate: number;
  taxInclusive: boolean;
  taxLabel: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  shippingFee: number;
  freeShippingThreshold: number | null;
  minOrderAmount: number | null;
  codEnabled: boolean;
  codFee: number;
  codMaxAmount: number | null;
  paymentProviders: PaymentProvider[];
  sortOrder: number;
  _count?: { orders: number; prices: number };
}
interface Provider {
  id: PaymentProvider;
  label: string;
  regions: string;
  description: string;
  configured: boolean;
  webhookUrl: string;
  webhookConfigured: boolean;
  mode: string;
}

const EMPTY: MarketRow = {
  id: '',
  code: '',
  name: '',
  enabled: true,
  currency: 'USD',
  countries: [],
  isDefault: false,
  isFallback: false,
  exchangeRate: 1,
  rounding: 'x99',
  taxRate: 0,
  taxInclusive: true,
  taxLabel: 'Tax',
  deliveryEnabled: true,
  pickupEnabled: false,
  shippingFee: 0,
  freeShippingThreshold: null,
  minOrderAmount: null,
  codEnabled: false,
  codFee: 0,
  codMaxAmount: null,
  paymentProviders: ['stripe'],
  sortOrder: 0,
};

function MoneyInput({ value, currency, onChange, nullable }: { value: number | null; currency: string; onChange: (v: number | null) => void; nullable?: boolean }) {
  const [text, setText] = useState(fromMinorInput(value, currency));
  return (
    <Input
      inputMode="decimal"
      value={text}
      placeholder={nullable ? 'none' : '0'}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value === '' && nullable ? null : toMinorInput(e.target.value || '0', currency));
      }}
    />
  );
}

function MarketForm({ market, onClose }: { market: MarketRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [m, setM] = useState<MarketRow>(market);
  const [countryQuery, setCountryQuery] = useState('');
  const countries = useMemo(() => listCountries('en'), []);
  const set = <K extends keyof MarketRow>(k: K, v: MarketRow[K]) => setM({ ...m, [k]: v });
  const save = useMutation({
    mutationFn: () => {
      const { id, _count, ...body } = m;
      return id ? put(`/markets/${id}`, body) : post('/markets', body);
    },
    onSuccess: () => {
      toast.success('Market saved');
      qc.invalidateQueries({ queryKey: ['markets'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => del(`/markets/${m.id}`),
    onSuccess: () => (toast.success('Deleted'), qc.invalidateQueries({ queryKey: ['markets'] }), onClose()),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const matches = countryQuery ? countries.filter((c) => !m.countries.includes(c.code) && (c.name.toLowerCase().includes(countryQuery.toLowerCase()) || c.code === countryQuery.toUpperCase())).slice(0, 8) : [];

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={m.id ? `Edit ${m.name}` : 'New market'}
      footer={
        <>
          {m.id ? (
            <Button variant="danger" onClick={() => window.confirm('Delete this market?') && remove.mutate()} loading={remove.isPending}>
              Delete
            </Button>
          ) : null}
          <span className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save market
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Name" className="md:col-span-2">
            <Input value={m.name} onChange={(e) => set('name', e.target.value)} placeholder="Bangladesh" />
          </Field>
          <Field label="Code">
            <Input value={m.code} onChange={(e) => set('code', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="bd" />
          </Field>
          <Field label="Currency (ISO)">
            <Input value={m.currency} maxLength={3} onChange={(e) => set('currency', e.target.value.toUpperCase())} placeholder="BDT" />
          </Field>
        </div>
        <Field label="Countries" hint={m.isFallback ? 'Fallback market: also used for every country not listed in another market.' : 'A country can only belong to one market.'}>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-300 p-2">
            {m.countries.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs">
                {countries.find((x) => x.code === c)?.name ?? c}
                <button type="button" onClick={() => set('countries', m.countries.filter((x) => x !== c))} className="text-zinc-400 hover:text-zinc-900">
                  ×
                </button>
              </span>
            ))}
            <div className="relative min-w-40 flex-1">
              <input className="w-full px-1 py-0.5 text-sm outline-none" placeholder="Add country…" value={countryQuery} onChange={(e) => setCountryQuery(e.target.value)} />
              {matches.length ? (
                <ul className="absolute z-10 mt-1 w-64 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                  {matches.map((c) => (
                    <li key={c.code}>
                      <button type="button" className="w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-50" onClick={() => (set('countries', [...m.countries, c.code]), setCountryQuery(''))}>
                        {c.name} <span className="text-xs text-zinc-400">{c.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </Field>
        <div className="grid gap-4 md:grid-cols-4">
          <Switch checked={m.enabled} onChange={(v) => set('enabled', v)} label="Enabled" />
          <Switch checked={m.isDefault} onChange={(v) => set('isDefault', v)} label="Default price list" description="Other markets convert from it." />
          <Switch checked={m.isFallback} onChange={(v) => set('isFallback', v)} label="Rest of the world" />
          <Field label="Sort order">
            <Input type="number" value={m.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value))} />
          </Field>
        </div>
        <fieldset className="grid gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-4">
          <legend className="px-1 text-sm font-semibold">Pricing & tax</legend>
          <Field label="Exchange rate" hint="1 default-currency unit =">
            <Input type="number" step="0.0001" value={m.exchangeRate} onChange={(e) => set('exchangeRate', Number(e.target.value))} disabled={m.isDefault} />
          </Field>
          <Field label="Rounding of converted prices">
            <Select value={m.rounding} onChange={(e) => set('rounding', e.target.value as any)}>
              <option value="none">Exact</option>
              <option value="whole">Whole number (৳904)</option>
              <option value="x99">Charm .99 ($7.99)</option>
            </Select>
          </Field>
          <Field label="Tax rate (%)">
            <Input type="number" step="0.01" value={m.taxRate} onChange={(e) => set('taxRate', Number(e.target.value))} />
          </Field>
          <Field label="Tax label">
            <Input value={m.taxLabel} onChange={(e) => set('taxLabel', e.target.value)} placeholder="VAT / GST / Sales tax" />
          </Field>
          <Switch checked={m.taxInclusive} onChange={(v) => set('taxInclusive', v)} label="Prices include tax" description="EU/UK/BD/IN style. Off = tax added at checkout (US/CA)." />
        </fieldset>
        <fieldset className="grid gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-4">
          <legend className="px-1 text-sm font-semibold">Delivery</legend>
          <Switch checked={m.deliveryEnabled} onChange={(v) => set('deliveryEnabled', v)} label="Home delivery" />
          <Switch checked={m.pickupEnabled} onChange={(v) => set('pickupEnabled', v)} label="Pick-up at locations" />
          <Field label={`Delivery fee (${m.currency})`}>
            <MoneyInput value={m.shippingFee} currency={m.currency} onChange={(v) => set('shippingFee', v ?? 0)} />
          </Field>
          <Field label="Free delivery from">
            <MoneyInput value={m.freeShippingThreshold} currency={m.currency} nullable onChange={(v) => set('freeShippingThreshold', v)} />
          </Field>
          <Field label="Minimum order">
            <MoneyInput value={m.minOrderAmount} currency={m.currency} nullable onChange={(v) => set('minOrderAmount', v)} />
          </Field>
        </fieldset>
        <fieldset className="grid gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-4">
          <legend className="px-1 text-sm font-semibold">Payments</legend>
          <div className="md:col-span-2">
            <Switch checked={m.codEnabled} onChange={(v) => set('codEnabled', v)} label="Cash on delivery" description="Typical in Bangladesh, India and much of Asia. Usually off for US/UK/CA/EU." />
          </div>
          <Field label="COD fee">
            <MoneyInput value={m.codFee} currency={m.currency} onChange={(v) => set('codFee', v ?? 0)} />
          </Field>
          <Field label="COD only up to" hint="Fraud limit; empty = no limit">
            <MoneyInput value={m.codMaxAmount} currency={m.currency} nullable onChange={(v) => set('codMaxAmount', v)} />
          </Field>
          <div className="space-y-2 md:col-span-4">
            <p className="label">Online payment gateways</p>
            <div className="flex flex-wrap gap-4">
              {PAYMENT_PROVIDERS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-brand" checked={m.paymentProviders.includes(p)} onChange={(e) => set('paymentProviders', e.target.checked ? [...m.paymentProviders, p] : m.paymentProviders.filter((x) => x !== p))} />
                  {PROVIDER_CHOICE[p]}
                </label>
              ))}
            </div>
            {m.paymentProviders.filter((p) => !providerSupportsCurrency(p, m.currency)).map((p) => (
              <p key={p} className="text-xs text-amber-700">
                {PROVIDER_CHOICE[p].split(' (')[0]} does not accept {m.currency}, so it is not offered at checkout in this market.
              </p>
            ))}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

export default function MarketsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['markets'], queryFn: () => get<MarketRow[]>('/markets') });
  const { data: providers = [] } = useQuery({ queryKey: ['providers'], queryFn: () => get<Provider[]>('/payment-providers') });
  const [editing, setEditing] = useState<MarketRow | null>(null);
  if (isLoading) return <Loading />;
  return (
    <>
      <PageHeader
        title="Markets & payments"
        description="Each market groups countries with their currency, prices, taxes, delivery and allowed payment methods. Visitors are matched to a market by their delivery country."
        actions={
          <Button onClick={() => setEditing(EMPTY)}>
            <Plus className="size-4" /> New market
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((m) => (
          <button key={m.id} type="button" onClick={() => setEditing(m)} className="card p-5 text-left transition hover:border-zinc-400">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{m.name}</p>
                <p className="text-xs text-zinc-500">
                  {m.currency} · {m.isFallback ? 'all other countries' : `${m.countries.length} countr${m.countries.length === 1 ? 'y' : 'ies'}`}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {m.isDefault ? <Badge color="blue">default</Badge> : null}
                {!m.enabled ? <Badge>off</Badge> : null}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {m.codEnabled ? <Badge color="green">Cash on delivery</Badge> : <Badge>No COD</Badge>}
              {m.paymentProviders.map((p) => (
                <Badge key={p} color="violet">
                  {p}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Delivery {money(m.shippingFee, m.currency)}
              {m.freeShippingThreshold !== null ? ` · free from ${money(m.freeShippingThreshold, m.currency)}` : ''} · {m.taxLabel} {m.taxRate}% {m.taxInclusive ? 'incl.' : 'excl.'}
            </p>
          </button>
        ))}
      </div>
      <Card title="Payment gateways" className="mt-6">
        <ul className="divide-y divide-zinc-100">
          {providers.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-4 py-3">
              {p.configured ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-zinc-300" />}
              <div className="min-w-60 flex-1">
                <p className="font-medium">
                  {p.label} {p.configured ? <Badge color={p.mode === 'live' ? 'green' : 'yellow'}>{p.mode}</Badge> : <Badge>not configured</Badge>}
                </p>
                <p className="text-xs text-zinc-500">
                  {p.regions} — {p.description}
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                <span className="text-zinc-500">Webhook{p.webhookConfigured ? '' : ' (secret missing)'}:</span>
                <code className="min-w-0 rounded bg-zinc-100 px-1.5 py-0.5 break-all">{p.webhookUrl}</code>
                <Button size="sm" variant="ghost" onClick={() => (navigator.clipboard.writeText(p.webhookUrl), toast.success('Copied'))}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {editing ? <MarketForm market={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
