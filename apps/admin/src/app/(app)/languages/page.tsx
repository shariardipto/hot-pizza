'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { LANGUAGES } from '@app/shared/i18n';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Switch } from '@/components/ui';
import { del, errorMessage, patch, post } from '@/lib/api';
import { useMe } from '@/lib/me';

export default function LanguagesPage() {
  const { locales, can, setLocale } = useMe();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [custom, setCustom] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const manage = can('locales.manage');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['locales'] });
    qc.invalidateQueries({ queryKey: ['collection'] });
  };
  const add = useMutation({
    mutationFn: () => post('/locales', { code: custom || code, copyFrom: copyFrom || undefined }),
    onSuccess: () => {
      toast.success('Language added (hidden until you enable it)');
      refresh();
      setLocale(custom || code);
      setAdding(false);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const update = useMutation({ mutationFn: ({ c, body }: { c: string; body: object }) => patch(`/locales/${c}`, body), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const makeDefault = useMutation({
    mutationFn: (c: string) => post(`/locales/${c}/default`),
    onSuccess: () => (toast.success('Default language changed'), refresh()),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({ mutationFn: (c: string) => del(`/locales/${c}`), onSuccess: () => (toast.success('Language deleted'), refresh()), onError: (e) => toast.error(errorMessage(e)) });
  const available = LANGUAGES.filter((l) => !locales.some((x) => x.code === l.code));

  return (
    <>
      <PageHeader
        title="Languages"
        description="The default language has no URL prefix (/about); others do (/es/about). Untranslated texts fall back to the default language."
        actions={
          manage ? (
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add language
            </Button>
          ) : null
        }
      />
      <Card bodyClassName="p-0">
        <ul className="divide-y divide-zinc-100">
          {locales.map((l) => {
            const pct = l.totalEntries ? Math.round((l.translatedEntries / l.totalEntries) * 100) : 0;
            return (
              <li key={l.code} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">
                    {l.nativeName} <span className="font-mono text-xs text-zinc-500">{l.code}</span> {l.isDefault ? <Badge color="blue">default</Badge> : null} {l.dir === 'rtl' ? <Badge>RTL</Badge> : null}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-40 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-zinc-500">
                      {l.translatedEntries}/{l.totalEntries} pages & items translated
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setLocale(l.code)}>
                  Edit content
                </Button>
                {manage ? (
                  <>
                    <Switch checked={l.enabled} disabled={l.isDefault} onChange={(v) => update.mutate({ c: l.code, body: { enabled: v } })} label={l.enabled ? 'Visible' : 'Hidden'} />
                    {!l.isDefault ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => window.confirm(`Make ${l.name} the default language?`) && makeDefault.mutate(l.code)}>
                          <Star className="size-4" /> Make default
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => window.confirm(`Delete ${l.name} and all its translations?`) && remove.mutate(l.code)}>
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add a language"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={() => add.mutate()} loading={add.isPending} disabled={!code && !custom}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Language">
            <Select value={code} onChange={(e) => setCode(e.target.value)}>
              <option value="">— Choose —</option>
              {available.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} — {l.nativeName} ({l.code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="…or a BCP 47 code" hint="e.g. fr-CA, es-MX">
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="xx or xx-YY" />
          </Field>
          <Field label="Start from" hint="Copies every text so you can translate instead of starting empty.">
            <Select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              <option value="">Empty (fall back to default language)</option>
              {locales.map((l) => (
                <option key={l.code} value={l.code}>
                  Copy of {l.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
