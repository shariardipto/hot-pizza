import type { AboutContent } from '@app/shared/content';
import { AboutPage } from '@/components/views/AboutPage';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/data';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await getLocale((await params).locale);
  return buildMetadata(locale, '/about', await api.singleton<AboutContent>('about', locale), 'Our history');
}

export default async function Page({ params }: Props) {
  const { locale } = await getLocale((await params).locale);
  return <AboutPage page={await api.singleton<AboutContent>('about', locale)} />;
}
