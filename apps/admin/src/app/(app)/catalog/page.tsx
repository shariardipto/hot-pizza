'use client';

import { CollectionList } from '@/components/collection-list';
import { PageHeader } from '@/components/ui';

export default function CatalogHub() {
  return (
    <>
      <PageHeader title="Catalog" description="Products (content, prices, stock), menu categories and flavors (page colors)." />
      <div className="space-y-5">
        <CollectionList type="product" description="Open a product to edit its texts, images, prices per market and stock." />
        <div className="grid gap-5 lg:grid-cols-2">
          <CollectionList type="productType" />
          <CollectionList type="flavor" />
        </div>
      </div>
    </>
  );
}
