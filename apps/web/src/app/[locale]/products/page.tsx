import type { ProductsPageContent } from '@app/shared/content';
import { ProductsPage } from '@/components/views/ProductsPage';
import { api } from '@/lib/api';
import { getCatalog, getCountry, getLocale } from '@/lib/data';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await getLocale((await params).locale);
  return buildMetadata(locale, '/products', await api.singleton<ProductsPageContent>('productsPage', locale), 'Products');
}

export default async function Page({ params }: Props) {
  const { locale, settings } = await getLocale((await params).locale);
  const [page, catalog] = await Promise.all([api.singleton<ProductsPageContent>('productsPage', locale), getCatalog(locale, await getCountry(settings))]);
  return <ProductsPage page={page} catalog={catalog} />;
}
