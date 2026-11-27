'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { singletonTypes } from '@app/shared/content';
import { Card, PageHeader } from '@/components/ui';

export default function TextsHub() {
  return (
    <>
      <PageHeader title="Texts & footer" description="Words used across the whole website: labels, footer, social links, menu, cart, checkout and reservation texts." />
      <Card bodyClassName="p-0">
        <ul className="divide-y divide-zinc-100">
          {(['globals', 'ui'] as const).map((k) => (
            <li key={k}>
              <Link href={`/content/${k}`} className="flex items-center justify-between px-5 py-4 hover:bg-zinc-50">
                <span>
                  <span className="font-medium">{singletonTypes[k].label}</span>
                  <span className="block text-sm text-zinc-500">{singletonTypes[k].description ?? 'Product labels, related products, banners, footer and social links.'}</span>
                </span>
                <ChevronRight className="size-4 text-zinc-400" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
