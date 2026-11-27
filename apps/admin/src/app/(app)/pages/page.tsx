'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { singletonTypes } from '@app/shared/content';
import { CollectionList } from '@/components/collection-list';
import { Card, PageHeader } from '@/components/ui';

const PAGES = ['home', 'about', 'productsPage', 'contact', 'locationsPage'] as const;

export default function PagesHub() {
  return (
    <>
      <PageHeader title="Pages" description="Every text and image of the website pages. Pick a language in the top bar to translate." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Website pages" bodyClassName="p-0">
          <ul className="divide-y divide-zinc-100">
            {PAGES.map((k) => (
              <li key={k}>
                <Link href={`/content/${k}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-50">
                  <span>
                    <span className="font-medium">{singletonTypes[k].label}</span>
                    <span className="block font-mono text-xs text-zinc-500">{singletonTypes[k].path}</span>
                  </span>
                  <ChevronRight className="size-4 text-zinc-400" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <CollectionList type="legal" />
      </div>
    </>
  );
}
