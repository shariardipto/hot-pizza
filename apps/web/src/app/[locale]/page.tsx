import type { HomeContent } from '@app/shared/content';
import { HomePage } from '@/components/views/HomePage';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/data';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await getLocale((await params).locale);
  const page = await api.singleton<HomeContent>('home', locale);
  return buildMetadata(locale, '/', page);
}

export default async function Page({ params }: Props) {
  const { locale } = await getLocale((await params).locale);
  const page = await api.singleton<HomeContent>('home', locale);
  return <HomePage page={page} />;
}
