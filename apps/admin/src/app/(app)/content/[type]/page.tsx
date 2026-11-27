'use client';

import { use } from 'react';
import { contentTypes } from '@app/shared/content';
import { CollectionList } from '@/components/collection-list';
import { EntryEditor } from '@/components/entry-editor';
import { PageHeader } from '@/components/ui';

const BACK: Record<string, string> = { product: '/catalog', productType: '/catalog', flavor: '/catalog', globals: '/texts', ui: '/texts' };

export default function ContentTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params);
  const def = contentTypes[type];
  if (!def) return <p>Unknown content type.</p>;
  if (def.kind === 'singleton') return <EntryEditor singleton={type} backHref={BACK[type] ?? '/pages'} />;
  return (
    <>
      <PageHeader title={def.label} description={def.description} />
      <CollectionList type={type} />
    </>
  );
}
