'use client';

import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, ShoppingBag, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { ORDER_STATUS_LABEL, RESERVATION_STATUS_LABEL, type OrderStatus, type ReservationStatus } from '@app/shared/commerce';
import { Badge, Card, Loading, PageHeader, STATUS_COLOR } from '@/components/ui';
import { get } from '@/lib/api';
import { useMe } from '@/lib/me';
import { dateTime, money } from '@/lib/utils';

interface Dash {
  ordersToday: number;
  pendingOrders: number;
  reservationsToday: number;
  pendingReservations: number;
  revenue: { day: string; currency: string; total: number; orders: number }[];
  recentOrders: { id: string; number: string; customerName: string; total: number; currency: string; status: OrderStatus; paymentStatus: string; paymentMethod: string; createdAt: string }[];
  upcomingReservations: { id: string; code: string; name: string; date: string; time: string; partySize: number; status: ReservationStatus; location: { name: string } }[];
  topProducts: { name: string; quantity: number }[];
}

function Stat({ label, value, icon: Icon, href }: { label: string; value: number | string; icon: any; href?: string }) {
  const body = (
    <div className="card flex items-center gap-4 p-5 transition hover:border-zinc-300">
      <span className="flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

/** 30-day revenue bars per currency (tiny inline SVG, no chart library). */
function RevenueChart({ rows }: { rows: Dash['revenue'] }) {
  const currencies = [...new Set(rows.map((r) => r.currency))];
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
  if (!rows.length) return <p className="py-8 text-center text-sm text-zinc-500">No sales in the last 30 days yet.</p>;
  return (
    <div className="space-y-6">
      {currencies.map((cur) => {
        const vals = days.map((d) => rows.filter((r) => r.day === d && r.currency === cur).reduce((s, r) => s + r.total, 0));
        const max = Math.max(...vals, 1);
        const total = vals.reduce((a, b) => a + b, 0);
        return (
          <div key={cur}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-medium">{cur}</span>
              <span className="text-sm tabular-nums text-zinc-600">{money(total, cur)} in 30 days</span>
            </div>
            <svg viewBox="0 0 300 80" className="h-24 w-full" preserveAspectRatio="none" role="img" aria-label={`Revenue ${cur}`}>
              {vals.map((v, i) => (
                <rect key={i} x={i * 10 + 1} width={8} y={80 - (v / max) * 76} height={(v / max) * 76} rx={1.5} className="fill-brand/80">
                  <title>{`${days[i]}: ${money(v, cur)}`}</title>
                </rect>
              ))}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { me, can } = useMe();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => get<Dash>('/dashboard'), refetchInterval: 60_000 });
  if (isLoading || !data) return <Loading />;
  return (
    <>
      <PageHeader title={`Hello, ${me.user.name.split(' ')[0]}`} description="Here is what is happening today." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Orders today" value={data.ordersToday} icon={ShoppingBag} href={can('orders.view') ? '/orders' : undefined} />
        <Stat label="Orders to confirm" value={data.pendingOrders} icon={Clock} href={can('orders.view') ? '/orders?status=pending' : undefined} />
        <Stat label="Bookings today" value={data.reservationsToday} icon={CalendarDays} href={can('reservations.view') ? '/reservations' : undefined} />
        <Stat label="Bookings to confirm" value={data.pendingReservations} icon={TrendingUp} href={can('reservations.view') ? '/reservations?status=pending' : undefined} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Revenue" description="Paid online + cash on delivery orders" className="xl:col-span-2">
          <RevenueChart rows={data.revenue} />
        </Card>
        <Card title="Best sellers" description="Last 30 days">
          {data.topProducts.length ? (
            <ol className="space-y-2 text-sm">
              {data.topProducts.map((p, i) => (
                <li key={p.name} className="flex justify-between gap-3">
                  <span className="truncate">
                    {i + 1}. {p.name}
                  </span>
                  <span className="tabular-nums text-zinc-500">×{p.quantity}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-500">No orders yet.</p>
          )}
        </Card>
        <Card title="Latest orders" className="xl:col-span-2" bodyClassName="p-0">
          <ul className="divide-y divide-zinc-100">
            {data.recentOrders.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-zinc-50">
                  <span className="w-24 font-mono text-xs">{o.number}</span>
                  <span className="flex-1 truncate">{o.customerName}</span>
                  <Badge color={STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  <span className="w-24 text-right tabular-nums">{money(o.total, o.currency)}</span>
                </Link>
              </li>
            ))}
            {!data.recentOrders.length ? <li className="px-5 py-8 text-center text-sm text-zinc-500">No orders yet.</li> : null}
          </ul>
        </Card>
        <Card title="Upcoming bookings" bodyClassName="p-0">
          <ul className="divide-y divide-zinc-100">
            {data.upcomingReservations.map((r) => (
              <li key={r.id}>
                <Link href={`/reservations/${r.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-zinc-50">
                  <span className="w-28 text-xs text-zinc-500">
                    {dateTime(`${r.date}T00:00:00`, { day: '2-digit', month: 'short' })} {r.time}
                  </span>
                  <span className="flex-1 truncate">
                    {r.name} · {r.partySize}
                  </span>
                  <Badge color={STATUS_COLOR[r.status]}>{RESERVATION_STATUS_LABEL[r.status]}</Badge>
                </Link>
              </li>
            ))}
            {!data.upcomingReservations.length ? <li className="px-5 py-8 text-center text-sm text-zinc-500">No upcoming bookings.</li> : null}
          </ul>
        </Card>
      </div>
    </>
  );
}
