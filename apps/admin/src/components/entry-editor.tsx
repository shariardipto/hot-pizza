'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, History, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { contentTypes, type Doc } from '@app/shared/content';
import { del, errorMessage, get, post, put, qs } from '@/lib/api';
import { useMe } from '@/lib/me';
import { dateTime, relative } from '@/lib/utils';
import { ContentForm } from './content-form';
import { ProductCommerce } from './product-commerce';
import { Badge, Button, Card, Field, Input, Loading, Modal, PageHeader, Select } from './ui';

interface EditPayload {
  id: string;
  type: string;
  slug: string;
  status: 'draft' | 'published';
  updatedAt: string;
  locale: string;
  defaultLocale: string;
  data: Doc;
  fallback: Doc | null;
  coverage: Record<string, { filled: number; total: number }>;
}

const WEB = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

function publicUrl(type: string, slug: string, locale: string, defaultLocale: string) {
  const def = contentTypes[type];
  if (!def?.path) return null;
  const path = def.path.replace(':slug', slug);
  return `${WEB}${locale === defaultLocale ? '' : `/${locale}`}${path === '/' ? '' : path}` || WEB;
}

export function EntryEditor({ id, singleton, backHref }: { id?: string; singleton?: string; backHref: string }) {
  const { locale, locales } = useMe();
  const qc = useQueryClient();
  const router = useRouter();
  const key = ['entry', id ?? singleton, locale];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => get<EditPayload>(singleton ? `/singletons/${singleton}${qs({ locale })}` : `/entries/${id}${qs({ locale })}`),
  });
  const [doc, setDoc] = useState<Doc>({});
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('published');
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<'content' | 'commerce'>('content');
  const [showRevisions, setShowRevisions] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDoc(data.data);
    setSlug(data.slug);
    setStatus(data.status);
    setDirty(false);
  }, [data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => put<EditPayload>(`/entries/${data!.id}`, { locale, data: doc, ...(singleton ? {} : { slug, status }) }),
    onSuccess: (r) => {
      toast.success('Saved — the website updates in a few seconds.');
      qc.setQueryData(key, r);
      qc.invalidateQueries({ queryKey: ['collection'] });
      setDirty(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => del(`/entries/${data!.id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['collection'] });
      router.push(backHref);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isLoading) return <Loading />;
  if (error || !data) return <p className="text-sm text-red-600">{errorMessage(error)}</p>;
  const def = contentTypes[data.type]!;
  const translating = data.locale !== data.defaultLocale;
  const cov = data.coverage[locale];
  const url = publicUrl(data.type, slug, locale, data.defaultLocale);
  const localeName = locales.find((l) => l.code === locale)?.nativeName ?? locale;

  return (
    <div className="pb-24">
      <PageHeader
        back={
          <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="size-3.5" /> Back
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {def.label}
            {!singleton ? <Badge color={status === 'published' ? 'green' : 'gray'}>{status}</Badge> : null}
          </span>
        }
        description={
          <>
            Editing in <strong>{localeName}</strong>
            {cov ? ` · ${cov.filled}/${cov.total} texts translated` : translating ? ' · not translated yet (showing default language as placeholders)' : ''} · updated{' '}
            {relative(data.updatedAt)}
          </>
        }
        actions={
          <>
            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  <ExternalLink className="size-4" /> View
                </Button>
              </a>
            ) : null}
            <Button variant="secondary" onClick={() => setShowRevisions(true)}>
              <History className="size-4" /> History
            </Button>
          </>
        }
      />

      {data.type === 'product' ? (
        <div className="mb-5 inline-flex rounded-lg border border-zinc-200 bg-white p-1 text-sm">
          {(['content', 'commerce'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 capitalize ${tab === t ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
              {t === 'commerce' ? 'Prices & stock' : 'Content'}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'commerce' && data.type === 'product' ? (
        <ProductCommerce productId={data.id} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_18rem]">
          <ContentForm
            fields={def.fields}
            value={doc}
            fallback={translating ? data.fallback : null}
            translating={translating}
            onChange={(v) => {
              setDoc(v);
              setDirty(true);
            }}
          />
          {!singleton ? (
            <div className="space-y-5">
              <Card title="Publishing">
                <div className="space-y-4">
                  <Field label="Status">
                    <Select value={status} onChange={(e) => (setStatus(e.target.value as any), setDirty(true))}>
                      <option value="published">Published</option>
                      <option value="draft">Draft (hidden)</option>
                    </Select>
                  </Field>
                  <Field label="URL slug" hint="Lowercase letters, numbers and dashes.">
                    <Input value={slug} onChange={(e) => (setSlug(e.target.value), setDirty(true))} />
                  </Field>
                  <Button variant="danger" className="w-full" loading={remove.isPending} onClick={() => window.confirm('Delete this entry in all languages? This cannot be undone.') && remove.mutate()}>
                    <Trash2 className="size-4" /> Delete
                  </Button>
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      )}

      {tab === 'content' ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 backdrop-blur lg:pl-64">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 px-4 py-3 lg:px-8">
            {dirty ? <span className="text-sm text-amber-700">Unsaved changes</span> : <span className="text-sm text-zinc-400">All changes saved</span>}
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
              <Save className="size-4" /> Save {translating ? `(${locale})` : ''}
            </Button>
          </div>
        </div>
      ) : null}

      <Revisions open={showRevisions} onClose={() => setShowRevisions(false)} entryId={data.id} onRestored={() => qc.invalidateQueries({ queryKey: ['entry'] })} />
    </div>
  );
}

function Revisions({ open, onClose, entryId, onRestored }: { open: boolean; onClose: () => void; entryId: string; onRestored: () => void }) {
  const { data = [] } = useQuery({ queryKey: ['revisions', entryId], queryFn: () => get<{ id: string; author: string | null; createdAt: string }[]>(`/entries/${entryId}/revisions`), enabled: open });
  const restore = useMutation({
    mutationFn: (rev: string) => post(`/entries/${entryId}/revisions/${rev}/restore`),
    onSuccess: () => {
      toast.success('Version restored');
      onRestored();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Modal open={open} onClose={onClose} title="Version history">
      {data.length ? (
        <ul className="divide-y divide-zinc-100">
          {data.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
              <span>
                {dateTime(r.createdAt)} <span className="text-zinc-500">· {r.author ?? 'system'}</span>
              </span>
              <Button size="sm" variant="secondary" loading={restore.isPending && restore.variables === r.id} onClick={() => window.confirm('Restore this version (all languages)?') && restore.mutate(r.id)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No earlier versions yet — a snapshot is kept every time you save.</p>
      )}
    </Modal>
  );
}
