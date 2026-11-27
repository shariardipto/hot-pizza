'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { contentTypes } from '@app/shared/content';
import { errorMessage, get, post, qs } from '@/lib/api';
import { useMe } from '@/lib/me';
import { relative } from '@/lib/utils';
import { thumb } from './media-picker';
import { Badge, Button, Card, Field, Input, Loading, Modal, STATUS_COLOR } from './ui';

interface Row {
  id: string;
  slug: string;
  status: 'draft' | 'published';
  sortOrder: number;
  updatedAt: string;
  title: string;
  image: string | null;
  translated: string[];
  commerce: { orderable: boolean; trackStock: boolean; stock: number } | null;
  priceCount: number;
}

export function CollectionList({ type, title, description }: { type: string; title?: string; description?: string }) {
  const { locale, locales } = useMe();
  const qc = useQueryClient();
  const router = useRouter();
  const def = contentTypes[type]!;
  const { data = [], isLoading } = useQuery({ queryKey: ['collection', type, locale], queryFn: () => get<Row[]>(`/collections/${type}${qs({ locale })}`) });
  const [creating, setCreating] = useState(false);
  const [slug, setSlug] = useState('');

  const reorder = useMutation({
    mutationFn: (ids: string[]) => post(`/collections/${type}/reorder`, { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collection', type] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const create = useMutation({
    mutationFn: () => post<{ id: string }>(`/collections/${type}`, { slug, locale }),
    onSuccess: (r) => {
      toast.success('Created as draft');
      router.push(`/content/${type}/${r.id}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const move = (i: number, d: number) => {
    const ids = data.map((r) => r.id);
    const [x] = ids.splice(i, 1);
    ids.splice(i + d, 0, x!);
    reorder.mutate(ids);
  };

  return (
    <Card
      title={title ?? def.label}
      description={description ?? def.description}
      actions={
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New
        </Button>
      }
      bodyClassName="p-0"
    >
      {isLoading ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {data.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
              <div className="flex flex-col">
                <button className="text-zinc-400 hover:text-zinc-900 disabled:opacity-30" disabled={i === 0 || reorder.isPending} onClick={() => move(i, -1)} aria-label="Move up">
                  <ArrowUp className="size-3.5" />
                </button>
                <button className="text-zinc-400 hover:text-zinc-900 disabled:opacity-30" disabled={i === data.length - 1 || reorder.isPending} onClick={() => move(i, 1)} aria-label="Move down">
                  <ArrowDown className="size-3.5" />
                </button>
              </div>
              <div className="size-12 shrink-0 overflow-hidden rounded-md bg-zinc-100">{r.image ? <img src={thumb(r.image, 120)} alt="" className="size-full object-contain" /> : null}</div>
              <Link href={`/content/${type}/${r.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="truncate font-mono text-xs text-zinc-500">
                  /{r.slug} · updated {relative(r.updatedAt)}
                </p>
              </Link>
              <div className="hidden items-center gap-1 sm:flex">
                {locales.map((l) => (
                  <span key={l.code} title={r.translated.includes(l.code) ? `${l.name}: translated` : `${l.name}: missing`} className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${r.translated.includes(l.code) ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-400 line-through'}`}>
                    {l.code}
                  </span>
                ))}
              </div>
              {type === 'product' && r.commerce ? (
                <span className="hidden text-xs text-zinc-500 md:block">
                  {r.commerce.orderable ? `${r.priceCount} price${r.priceCount === 1 ? '' : 's'}` : 'not for sale'}
                  {r.commerce.trackStock ? ` · ${r.commerce.stock} in stock` : ''}
                </span>
              ) : null}
              <Badge color={STATUS_COLOR[r.status]}>{r.status}</Badge>
            </li>
          ))}
          {!data.length ? <li className="px-5 py-10 text-center text-sm text-zinc-500">No entries yet.</li> : null}
        </ul>
      )}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={`New ${def.label.toLowerCase()}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!slug}>
              Create
            </Button>
          </>
        }
      >
        <Field label="URL slug" hint="Used in the page address, e.g. margherita. You can change it later.">
          <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))} autoFocus />
        </Field>
      </Modal>
    </Card>
  );
}
