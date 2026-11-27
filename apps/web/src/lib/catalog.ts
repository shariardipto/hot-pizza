import type { SiteValue } from './site';

/** Same derived structures the original store built at boot (product types with flavors, flavor map). */
export function buildCatalogIndex(products: SiteValue['products']) {
  const types = new Map<string, { uid: string; id: string; name: string; order: number; data: any; relatedFlavors: string[] }>();
  const flavors = new Map<string, { uid: string; id: string; data: any; relatedProducts: string[] }>();
  for (const p of products) {
    const t = p.typeEntry;
    const f = p.flavorEntry;
    if (t) {
      const entry = types.get(t.slug) ?? { uid: t.slug, id: t.id, name: t.data.name ?? '', order: t.sortOrder, data: t.data, relatedFlavors: [] };
      if (f && !entry.relatedFlavors.includes(f.slug)) entry.relatedFlavors.push(f.slug);
      types.set(t.slug, entry);
    }
    if (f) {
      const entry = flavors.get(f.slug) ?? { uid: f.slug, id: f.id, data: f.data, relatedProducts: [] };
      entry.relatedProducts.push(p.slug);
      flavors.set(f.slug, entry);
    }
  }
  const sortedTypes = [...types.values()].sort((a, b) => a.order - b.order);
  const list = products.map((p) => ({
    uid: p.slug,
    id: p.id,
    type: { uid: p.typeEntry?.slug, name: p.typeEntry?.data.name, order: p.typeEntry?.sortOrder },
    flavor: { ...(p.flavorEntry?.data ?? {}), uid: p.flavorEntry?.slug, optimizeLegibility: p.flavorEntry?.data.optimizeLegibility },
    image: p.data.image?.url ?? '',
    data: p.data,
  }));
  return { types: sortedTypes, typeMap: Object.fromEntries(sortedTypes.map((t) => [t.uid, t])), flavorMap: Object.fromEntries(flavors), products: list };
}
