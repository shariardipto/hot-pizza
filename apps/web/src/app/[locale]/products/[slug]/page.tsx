import { notFound } from 'next/navigation';
import { ProductPage } from '@/components/views/ProductPage';
import { getCatalog, getCountry, getLocale } from '@/lib/data';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

async function load(params: Props['params']) {
  const { locale: seg, slug } = await params;
  const { locale, settings } = await getLocale(seg);
  const catalog = await getCatalog(locale, await getCountry(settings));
  const product = catalog.products.find((p) => p.slug === slug);
  if (!product) notFound();
  return { locale, product };
}

export async function generateMetadata({ params }: Props) {
  const { locale, product } = await load(params);
  return buildMetadata(locale, `/products/${product.slug}`, { ...product.data, metaImage: product.data.metaImage ?? product.data.image }, 'Product');
}

export default async function Page({ params }: Props) {
  const { product } = await load(params);
  return <ProductPage product={product} />;
}
