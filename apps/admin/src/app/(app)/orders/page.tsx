'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ORDER_STATUS_LABEL, ORDER_STATUSES, PAYMENT_STATUS_LABEL, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from '@app/shared/commerce';
import { formatPhone } from '@app/shared/schemas';
import { Badge, Card, Input, Loading, PageHeader, Pagination, Select, STATUS_COLOR, Table, Button } from '@/components/ui';
import { get, qs } from '@/lib/api';
import { dateTime, money } from '@/lib/utils';

interface Row {
  id: string;
  number: string;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  fulfillment: string;
  customerName: string;
  customerPhone: string;
  total: number;
  currency: string;
  country: string;
  market: { name: string };
  _count: { items: number };
}

function Orders() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get('q') ?? '');
  const filters = {
    status: params.get('status') ?? '',
    paymentStatus: params.get('paymentStatus') ?? '',
    paymentMethod: params.get('paymentMethod') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    q: params.get('q') ?? '',
    page: Number(params.get('page') ?? 1),
  };
  const setFilter = (patch: Record<string, string | number>) => router.replace(`/orders${qs({ ...filters, page: 1, ...patch })}`);
  const { data, isLoading } = useQuery({ queryKey: ['orders', filters], queryFn: () => get<{ items: Row[]; total: number; page: number; pageSize: number }>(`/orders${qs({ ...filters, pageSize: 25 })}`), refetchInterval: 30_000 });

  return (
    <>
      <PageHeader
        title="Orders"
        description="Guest orders from the website. New orders refresh automatically."
        actions={
          <a href={`/api/v1/admin/orders/export.csv${qs({ status: filters.status, from: filters.from, to: filters.to })}`}>
            <Button variant="secondary">
              <Download className="size-4" /> Export CSV
            </Button>
          </a>
        }
      />
      <Card bodyClassName="p-0">
        <div className="grid gap-3 border-b border-zinc-100 p-4 md:grid-cols-6">
          <form
            className="relative md:col-span-2"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter({ q });
            }}
          >
            <Search className="absolute top-2.5 left-2.5 size-4 text-zinc-400" />
            <Input className="pl-8" placeholder="Number, name, phone, e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <Select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select value={filters.paymentStatus} onChange={(e) => setFilter({ paymentStatus: e.target.value })}>
            <option value="">All payments</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Input type="date" value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} aria-label="From" />
          <Input type="date" value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} aria-label="To" />
        </div>
        {isLoading || !data ? (
          <Loading />
        ) : (
          <>
            <Table head={['Order', 'Date', 'Customer', 'Market', 'Payment', 'Status', 'Total']} empty={!data.items.length}>
              {data.items.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-zinc-50" onClick={() => router.push(`/orders/${o.id}`)}>
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/orders/${o.id}`}>{o.number}</Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{dateTime(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.customerName}</p>
                    <p className="text-xs text-zinc-500">{formatPhone(o.customerPhone)}</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {o.market.name} · {o.country}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[o.paymentStatus]}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</Badge>
                    <p className="mt-1 text-xs uppercase text-zinc-500">{o.paymentMethod === 'cod' ? 'Cash on delivery' : o.paymentMethod}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">{money(o.total, o.currency)}</td>
                </tr>
              ))}
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setFilter({ page: p })} />
          </>
        )}
      </Card>
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Orders />
    </Suspense>
  );
}
