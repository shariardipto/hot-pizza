import { notFound } from 'next/navigation';
import type { LegalContent } from '@app/shared/content';
import { LegalPage } from '@/components/views/InfoPages';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/data';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

async function load(params: Props['params']) {
  const { locale: seg, slug } = await params;
  const { locale } = await getLocale(seg);
  const entry = await api.entry<LegalContent>('legal', slug, locale).catch(() => null);
  if (!entry) notFound();
  return { locale, entry };
}

export async function generateMetadata({ params }: Props) {
  const { locale, entry } = await load(params);
  return buildMetadata(locale, `/legal/${entry.slug}`, entry.data, entry.data.title?.replace(/\s*\n\s*/g, ' '));
}

export default async function Page({ params }: Props) {
  const { entry } = await load(params);
  return <LegalPage page={entry.data} />;
}
