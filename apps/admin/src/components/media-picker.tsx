'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Search, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ImageValue } from '@app/shared/content';
import { api, errorMessage, get, qs } from '@/lib/api';
import { Button, Input, Modal, Spinner } from './ui';

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  folder: string;
  createdAt: string;
}

export const thumb = (url: string, w = 320) => (url.startsWith('/uploads/') ? `${url}?w=${w}&auto=format` : url);

/** Image types the API accepts; it converts every image to WebP. */
const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
const FONT_ACCEPT = '.woff2,.woff,.ttf,.otf';

export async function uploadFiles(files: FileList | File[], folder = ''): Promise<MediaItem[]> {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append('files', f));
  if (folder) fd.append('folder', folder);
  return api<MediaItem[]>('/media', { method: 'POST', body: fd });
}

export function MediaGrid({ onPick, accept = 'image' }: { onPick?: (m: MediaItem) => void; accept?: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const input = useRef<HTMLInputElement>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['media', q, page, accept],
    queryFn: () => get<{ items: MediaItem[]; total: number; pageSize: number }>(`/media${qs({ q, page, pageSize: 48, type: accept === 'all' ? '' : accept })}`),
  });
  const upload = useMutation({
    mutationFn: (files: File[]) => uploadFiles(files),
    onSuccess: (items) => {
      toast.success(`${items.length} file(s) uploaded`);
      qc.invalidateQueries({ queryKey: ['media'] });
      if (onPick && items[0]) onPick(items[0]);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        // Copy now: the browser empties the dropped file list once this event ends, before the upload runs.
        const files = Array.from(e.dataTransfer.files);
        if (files.length) upload.mutate(files);
      }}
    >
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-zinc-400" />
          <Input className="pl-8" placeholder="Search files…" value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} />
        </div>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={accept === 'image' ? IMAGE_ACCEPT : `${IMAGE_ACCEPT},${FONT_ACCEPT}`}
          onChange={(e) => {
            // Copy the files before clearing the input (clearing lets the same file be picked again, but it also
            // empties the live FileList — and the upload only reads it a moment later).
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) upload.mutate(files);
          }}
        />
        <Button onClick={() => input.current?.click()} loading={upload.isPending}>
          <Upload className="size-4" /> Upload
        </Button>
      </div>
      <p className="-mt-2 mb-4 text-xs text-zinc-500">PNG, JPG or WebP. Images are saved as WebP automatically.{accept === 'all' ? ' Font files are kept as they are.' : ''}</p>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {data?.items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick?.(m)}
              className="group overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-left transition hover:border-brand"
              title={m.filename}
            >
              {m.mimeType.startsWith('image/') ? (
                <img src={thumb(m.url)} alt={m.alt ?? ''} className="aspect-square w-full object-contain" loading="lazy" />
              ) : (
                <div className="flex aspect-square items-center justify-center text-xs text-zinc-500">{m.filename.split('.').pop()?.toUpperCase()}</div>
              )}
              <p className="truncate px-2 py-1 text-[11px] text-zinc-600">{m.filename}</p>
            </button>
          ))}
        </div>
      )}
      {data && data.total > data.pageSize ? (
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Image field: preview + pick from library / upload + alt text. */
export function ImageInput({ value, onChange }: { value: ImageValue | null | undefined; onChange: (v: ImageValue | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-start gap-3">
      <button type="button" onClick={() => setOpen(true)} className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 hover:border-brand">
        {value?.url ? <img src={thumb(value.url, 240)} alt="" className="size-full object-contain" /> : <ImagePlus className="size-6 text-zinc-400" />}
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        {value?.url ? (
          <>
            <p className="truncate font-mono text-xs text-zinc-500">{value.url}</p>
            <Input placeholder="Alt text (accessibility & SEO)" value={value.alt ?? ''} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                Replace
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                <X className="size-3.5" /> Remove
              </Button>
            </div>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Choose image
          </Button>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Media library" wide>
        <MediaGrid
          onPick={(m) => {
            onChange({ url: m.url, width: m.width ?? undefined, height: m.height ?? undefined, alt: m.alt ?? value?.alt ?? '', mediaId: m.id });
            setOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
