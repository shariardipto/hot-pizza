import { notFound } from 'next/navigation';
import { ReservationView } from '@/components/commerce/ReservationView';
import { api } from '@/lib/api';
import { getLocale, getUi } from '@/lib/data';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await getLocale((await params).locale);
  const ui = await getUi(locale);
  return buildMetadata(locale, '/reservations', null, (ui.navReservations || 'Reservations').replace(/\n/g, ' '));
}

export default async function Page({ params }: Props) {
  const { settings } = await getLocale((await params).locale);
  if (!settings.features.reservations) notFound();
  const locations = await api.locations('reservations');
  return <ReservationView locations={locations} />;
}
