import type { ContactContent } from '@app/shared/content';
import { ContactPage } from '@/components/views/InfoPages';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/data';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await getLocale((await params).locale);
  return buildMetadata(locale, '/contact', await api.singleton<ContactContent>('contact', locale), 'Contact');
}

export default async function Page({ params }: Props) {
  const { locale } = await getLocale((await params).locale);
  return <ContactPage page={await api.singleton<ContactContent>('contact', locale)} />;
}
