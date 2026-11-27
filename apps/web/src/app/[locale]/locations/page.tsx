import { notFound } from 'next/navigation';
import type { LocationsPageContent } from '@app/shared/content';
import { LocationsPage } from '@/components/views/InfoPages';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/data';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await getLocale((await params).locale);
  return buildMetadata(locale, '/locations', await api.singleton<LocationsPageContent>('locationsPage', locale), 'Our locations');
}

export default async function Page({ params }: Props) {
  const { locale, settings } = await getLocale((await params).locale);
  if (!settings.features.locationsPage) notFound();
  const [page, locations] = await Promise.all([api.singleton<LocationsPageContent>('locationsPage', locale), api.locations()]);
  return <LocationsPage page={page} locations={locations} />;
}
