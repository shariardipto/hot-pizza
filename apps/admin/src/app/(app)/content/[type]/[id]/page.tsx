'use client';

import { use } from 'react';
import { EntryEditor } from '@/components/entry-editor';

const BACK: Record<string, string> = { product: '/catalog', productType: '/catalog', flavor: '/catalog', legal: '/pages' };

export default function EntryPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = use(params);
  return <EntryEditor id={id} backHref={BACK[type] ?? `/content/${type}`} />;
}
