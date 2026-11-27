'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, MapPin, Phone, Store } from 'lucide-react';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, type OrderStatus, type PaymentStatus } from '@app/shared/commerce';
import { countryName } from '@app/shared/i18n';
import { formatPhone } from '@app/shared/schemas';
import { thumb } from '@/components/media-picker';
import { Badge, Button, Card, Field, Loading, Modal, PageHeader, STATUS_COLOR, Switch, Textarea } from '@/components/ui';
import { errorMessage, get, patch, post } from '@/lib/api';
import { useMe } from '@/lib/me';
import { dateTime, money } from '@/lib/utils';

interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  paymentRef: string | null;
  fulfillment: string;
  currency: string;
  country: string;
  locale: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  addressCountry: string | null;
  pickupLocation: { name: string; addressLine1: string; city: string } | null;
  notes: string | null;
  internalNote: string | null;
  subtotal: number;
  shipping: number;
  codFee: number;
  tax: number;
  taxInclusive: boolean;
  total: number;
  createdAt: string;
  paidAt: string | null;
  market: { name: string };
  items: { id: string; name: string; image: string | null; quantity: number; unitPrice: number; lineTotal: number; sku: string | null }[];
  events: { id: string; type: string; fromValue: string | null; toValue: string | null; message: string | null; actorName: string | null; createdAt: string }[];
  payments: { id: string; provider: string; providerRef: string | null; amount: number; currency: string; status: string; createdAt: string }[];
  allowedTransitions: OrderStatus[];
}

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirm order',
  preparing: 'Start preparing',
  ready: 'Mark ready for pick-up',
  shipped: 'Mark out for delivery',
  delivered: 'Mark delivered',
  completed: 'Complete',
  cancelled: 'Cancel order',
  refunded: 'Mark refunded',
};

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { can } = useMe();
  const { data: o, isLoading } = useQuery({ queryKey: ['order', id], queryFn: () => get<Order>(`/orders/${id}`) });
  const [note, setNote] = useState('');
  const [internal, setInternal] = useState('');
  const [pending, setPending] = useState<OrderStatus | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [notify, setNotify] = useState(true);
  useEffect(() => setInternal(o?.internalNote ?? ''), [o?.internalNote]);

  const refresh = (data: Order) => {
    qc.setQueryData(['order', id], data);
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const changeStatus = useMutation({
    mutationFn: () => post<Order>(`/orders/${id}/status`, { status: pending, note: statusNote || undefined, notifyCustomer: notify }),
    onSuccess: (d) => {
      refresh(d);
      toast.success(`Order ${ORDER_STATUS_LABEL[pending!].toLowerCase()}`);
      setPending(null);
      setStatusNote('');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const payStatus = useMutation({
    mutationFn: (status: 'paid' | 'unpaid') => post<Order>(`/orders/${id}/payment-status`, { status }),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const refund = useMutation({
    mutationFn: () => post<Order>(`/orders/${id}/refund`, {}),
    onSuccess: (d) => (refresh(d), toast.success('Refund recorded')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addNote = useMutation({
    mutationFn: () => post<Order>(`/orders/${id}/notes`, { message: note }),
    onSuccess: (d) => (refresh(d), setNote('')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const saveInternal = useMutation({
    mutationFn: () => patch<Order>(`/orders/${id}`, { internalNote: internal || null }),
    onSuccess: (d) => (refresh(d), toast.success('Saved')),
  });

  if (isLoading || !o) return <Loading />;
  const m = (v: number) => money(v, o.currency);
  const manage = can('orders.manage');

  return (
    <>
      <PageHeader
        back={
          <Link href="/orders" className="mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="size-3.5" /> Orders
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {o.number}
            <Badge color={STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
            <Badge color={STATUS_COLOR[o.paymentStatus]}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge>
          </span>
        }
        description={`${dateTime(o.createdAt)} · ${o.market.name} · ${o.paymentMethod === 'cod' ? 'Cash on delivery' : `Online (${o.paymentMethod})`} · ${o.fulfillment === 'pickup' ? 'Pick-up' : 'Delivery'}`}
        actions={
          manage ? (
            <>
              {o.allowedTransitions.map((s) => (
                <Button key={s} variant={s === 'cancelled' || s === 'refunded' ? 'danger' : 'primary'} onClick={() => setPending(s)}>
                  {ACTION_LABEL[s] ?? ORDER_STATUS_LABEL[s]}
                </Button>
              ))}
            </>
          ) : null
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <Card title="Items" bodyClassName="p-0">
            <ul className="divide-y divide-zinc-100">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <div className="size-12 overflow-hidden rounded-md bg-zinc-100">{i.image ? <img src={thumb(i.image, 120)} alt="" className="size-full object-contain" /> : null}</div>
                  <div className="flex-1">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-zinc-500">
                      {i.quantity} × {m(i.unitPrice)} {i.sku ? `· ${i.sku}` : ''}
                    </p>
                  </div>
                  <span className="tabular-nums">{m(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-zinc-100 px-5 py-4 text-sm">
              {[
                ['Subtotal', o.subtotal],
                ['Delivery', o.shipping],
                ...(o.codFee ? [['Cash on delivery fee', o.codFee] as const] : []),
                ...(o.tax ? [[`Tax${o.taxInclusive ? ' (included)' : ''}`, o.tax] as const] : []),
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between text-zinc-600">
                  <dt>{k}</dt>
                  <dd className="tabular-nums">{m(v as number)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-zinc-100 pt-2 text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{m(o.total)}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Timeline">
            <ol className="space-y-3 text-sm">
              {o.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                  <div>
                    <p>
                      <span className="font-medium capitalize">{e.type}</span>
                      {e.toValue ? ` → ${e.toValue}` : ''}
                      {e.message ? <span className="text-zinc-600"> — {e.message}</span> : null}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {dateTime(e.createdAt)}
                      {e.actorName ? ` · ${e.actorName}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {manage ? (
              <form
                className="mt-5 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (note.trim()) addNote.mutate();
                }}
              >
                <Textarea className="min-h-10" rows={1} placeholder="Add a note to the timeline…" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button type="submit" variant="secondary" loading={addNote.isPending}>
                  Add
                </Button>
              </form>
            ) : null}
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Customer">
            <div className="space-y-2 text-sm">
              <p className="font-medium">{o.customerName}</p>
              <a href={`tel:${o.customerPhone}`} className="flex items-center gap-2 text-zinc-700 hover:text-brand">
                <Phone className="size-4" /> {formatPhone(o.customerPhone)}
              </a>
              {o.customerEmail ? (
                <a href={`mailto:${o.customerEmail}`} className="flex items-center gap-2 text-zinc-700 hover:text-brand">
                  <Mail className="size-4" /> {o.customerEmail}
                </a>
              ) : null}
              {o.addressLine1 ? (
                <p className="flex gap-2 text-zinc-700">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  <span>
                    {o.addressLine1}
                    {o.addressLine2 ? <>, {o.addressLine2}</> : null}
                    <br />
                    {[o.postalCode, o.city].filter(Boolean).join(' ')}
                    {o.region ? `, ${o.region}` : ''}
                    <br />
                    {countryName(o.addressCountry ?? o.country)}
                  </span>
                </p>
              ) : null}
              {o.pickupLocation ? (
                <p className="flex gap-2 text-zinc-700">
                  <Store className="mt-0.5 size-4 shrink-0" /> Pick-up at {o.pickupLocation.name}, {o.pickupLocation.city}
                </p>
              ) : null}
              {o.notes ? <p className="rounded-lg bg-amber-50 p-3 text-amber-900">“{o.notes}”</p> : null}
            </div>
          </Card>
          <Card title="Payment">
            <div className="space-y-3 text-sm">
              <p>
                {o.paymentMethod === 'cod' ? 'Cash on delivery' : o.paymentMethod.toUpperCase()} — <strong>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</strong>
              </p>
              {o.paidAt ? <p className="text-zinc-500">Paid {dateTime(o.paidAt)}</p> : null}
              {o.payments.map((p) => (
                <p key={p.id} className="font-mono text-xs text-zinc-500">
                  {p.provider} · {p.providerRef} · {p.status} · {money(p.amount, p.currency)}
                </p>
              ))}
              {manage ? (
                <div className="flex flex-wrap gap-2">
                  {o.paymentStatus !== 'paid' ? (
                    <Button size="sm" variant="secondary" loading={payStatus.isPending} onClick={() => payStatus.mutate('paid')}>
                      Mark as paid
                    </Button>
                  ) : (
                    <Button size="sm" variant="danger" loading={refund.isPending} onClick={() => window.confirm(`Refund ${m(o.total)}?${o.paymentMethod === 'stripe' ? ' The card will be refunded via Stripe.' : o.paymentMethod === 'paypal' ? ' The money goes back to the customer through PayPal.' : ''}`) && refund.mutate()}>
                      Refund
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          </Card>
          <Card title="Internal note" description="Only visible to the team.">
            <Textarea value={internal} onChange={(e) => setInternal(e.target.value)} disabled={!manage} />
            {manage ? (
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => saveInternal.mutate()} loading={saveInternal.isPending}>
                Save note
              </Button>
            ) : null}
          </Card>
        </div>
      </div>
      <Modal
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title={pending ? (ACTION_LABEL[pending] ?? ORDER_STATUS_LABEL[pending]) : ''}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>
              Back
            </Button>
            <Button variant={pending === 'cancelled' ? 'danger' : 'primary'} onClick={() => changeStatus.mutate()} loading={changeStatus.isPending}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {pending === 'cancelled' ? <p className="text-sm text-zinc-600">Reserved stock is returned. Online payments already captured must be refunded separately.</p> : null}
          <Field label="Note (optional)">
            <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="e.g. courier tracking number" />
          </Field>
          {o.customerEmail ? <Switch checked={notify} onChange={setNotify} label="E-mail the customer" description={o.customerEmail} /> : null}
        </div>
      </Modal>
    </>
  );
}
