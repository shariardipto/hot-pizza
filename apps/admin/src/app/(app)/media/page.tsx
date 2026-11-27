'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { MediaGrid, thumb, type MediaItem } from '@/components/media-picker';
import { Button, Card, Field, Input, Modal, PageHeader } from '@/components/ui';
import { del, errorMessage, patch } from '@/lib/api';
import { dateTime } from '@/lib/utils';

export default function MediaPage() {
  const qc = useQueryClient();
  const [sel, setSel] = useState<MediaItem | null>(null);
  const [alt, setAlt] = useState('');
  const save = useMutation({
    mutationFn: () => patch(`/media/${sel!.id}`, { alt }),
    onSuccess: () => (toast.success('Saved'), qc.invalidateQueries({ queryKey: ['media'] }), setSel(null)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => del(`/media/${sel!.id}`),
    onSuccess: () => (toast.success('Deleted'), qc.invalidateQueries({ queryKey: ['media'] }), setSel(null)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <>
      <PageHeader title="Media library" description="Images, logos and fonts. Drag files onto the grid to upload. Images (PNG, JPG, WebP) are stored as WebP and resized for each screen automatically." />
      <Card>
        <MediaGrid accept="all" onPick={(m) => (setSel(m), setAlt(m.alt ?? ''))} />
      </Card>
      <Modal
        open={Boolean(sel)}
        onClose={() => setSel(null)}
        title={sel?.filename ?? ''}
        footer={
          <>
            <Button variant="danger" onClick={() => window.confirm('Delete this file? Pages using it will show nothing.') && remove.mutate()} loading={remove.isPending}>
              <Trash2 className="size-4" /> Delete
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              Save
            </Button>
          </>
        }
      >
        {sel ? (
          <div className="space-y-4">
            {sel.mimeType.startsWith('image/') ? <img src={thumb(sel.url, 800)} alt="" className="max-h-80 w-full rounded-lg bg-zinc-100 object-contain" /> : null}
            <dl className="grid grid-cols-2 gap-2 text-sm text-zinc-600">
              <dt>Type</dt>
              <dd>{sel.mimeType}</dd>
              <dt>Size</dt>
              <dd>{(sel.size / 1024).toFixed(0)} KB</dd>
              {sel.width ? (
                <>
                  <dt>Dimensions</dt>
                  <dd>
                    {sel.width} × {sel.height}
                  </dd>
                </>
              ) : null}
              <dt>Uploaded</dt>
              <dd>{dateTime(sel.createdAt)}</dd>
            </dl>
            <Field label="URL">
              <div className="flex gap-2">
                <Input readOnly value={sel.url} className="font-mono text-xs" />
                <Button variant="secondary" onClick={() => (navigator.clipboard.writeText(sel.url), toast.success('Copied'))}>
                  <Copy className="size-4" />
                </Button>
              </div>
            </Field>
            <Field label="Default alt text">
              <Input value={alt} onChange={(e) => setAlt(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
