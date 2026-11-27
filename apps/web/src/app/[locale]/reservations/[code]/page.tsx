import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReservationManage } from '@/components/commerce/ReservationView';
import { apiNoStore } from '@/lib/api';
import { getLocale } from '@/lib/data';

export const metadata: Metadata = { title: 'Reservation', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; code: string }>; searchParams: Promise<{ token?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const { locale, code } = await params;
  await getLocale(locale);
  const { token } = await searchParams;
  const r = token ? await apiNoStore.reservation(code, token).catch(() => null) : null;
  if (!r || !token) notFound();
  return <ReservationManage initial={r} code={code} token={token} />;
}
