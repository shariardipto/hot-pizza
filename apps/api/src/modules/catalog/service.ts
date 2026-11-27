import { priceForMarket, type Market } from '@app/shared/commerce';
import type {
  Catalog,
  CatalogProduct,
  Entry,
  FlavorContent,
  ProductContent,
  ProductTypeContent,
} from '@app/shared/content';
import { prisma } from '../../db.ts';
import { listEntries } from '../content/service.ts';
import { marketForCountry } from '../markets/service.ts';

export async function getCatalog(locale: string, country?: string | null): Promise<Catalog> {
  const [productTypes, flavors, products, commerce, prices, { market, defaultMarket }] = await Promise.all([
    listEntries<ProductTypeContent>('productType', locale),
    listEntries<FlavorContent>('flavor', locale),
    listEntries<ProductContent>('product', locale),
    prisma.productCommerce.findMany(),
    prisma.productPrice.findMany(),
    marketForCountry(country),
  ]);
  const typeById = new Map(productTypes.map((t) => [t.id, t]));
  const flavorById = new Map(flavors.map((f) => [f.id, f]));

  const withOffer: CatalogProduct[] = products.map((p) => ({
    ...p,
    typeEntry: typeById.get(p.data.type) ?? null,
    flavorEntry: flavorById.get(p.data.flavor) ?? null,
    offer: market ? offerFor(p, market, defaultMarket, commerce, prices) : null,
  }));

  return { productTypes, flavors, products: withOffer };
}

function offerFor(
  p: Entry<ProductContent>,
  market: Market,
  defaultMarket: Market | undefined,
  commerce: { productId: string; orderable: boolean; trackStock: boolean; stock: number; maxPerOrder: number }[],
  prices: { productId: string; marketId: string; amount: number; compareAtAmount: number | null }[],
) {
  const c = commerce.find((x) => x.productId === p.id);
  const price = priceForMarket(
    prices.filter((x) => x.productId === p.id),
    market,
    defaultMarket,
  );
  const inStock = !c?.trackStock || c.stock > 0;
  const maxQuantity = Math.max(0, Math.min(c?.maxPerOrder ?? 24, c?.trackStock ? c.stock : Infinity));
  return {
    orderable: Boolean(c?.orderable && price),
    inStock,
    price: price?.amount ?? null,
    compareAtPrice: price?.compareAtAmount ?? null,
    currency: market.currency,
    maxQuantity,
  };
}
