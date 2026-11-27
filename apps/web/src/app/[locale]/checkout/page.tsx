import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CheckoutView } from '@/components/commerce/CheckoutView';
import { getLocale } from '@/lib/data';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { settings } = await getLocale((await params).locale);
  if (!settings.features.ordering) notFound();
  return <CheckoutView />;
}
