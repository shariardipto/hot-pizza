import type { Metadata } from 'next';
import { OrderLookup, OrderView } from '@/components/commerce/OrderView';
import { apiNoStore } from '@/lib/api';
import { getLocale } from '@/lib/data';

export const metadata: Metadata = { title: 'Order', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; number: string }>; searchParams: Promise<{ token?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const { locale: seg, number } = await params;
  await getLocale(seg);
  const { token } = await searchParams;
  if (!token) return <OrderLookup />;
  const order = await apiNoStore.order(number, token).catch(() => null);
  if (!order) return <OrderLookup />;
  return <OrderView initial={order} number={number} token={token} />;
}
