import type { Metadata } from 'next';
import { OrderLookup } from '@/components/commerce/OrderView';

export const metadata: Metadata = { title: 'Track your order', robots: { index: false } };

export default function Page() {
  return <OrderLookup />;
}
