'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronDown, Copy, Globe2, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { isContainer, isLocalized, newItemId, type BlocksField, type Doc, type Field, type ListField } from '@app/shared/content';
import { get, qs } from '@/lib/api';
import { useMe } from '@/lib/me';
import { cn } from '@/lib/utils';
import { ImageInput } from './media-picker';
import { RichText } from './rich-text';
import { Badge, Button, Input, Select, Switch, Textarea } from './ui';

/** Color input with swatch + hex text. */
export function ColorInput({ value, onChange }: { value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value ?? '') ? value! : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded-md border border-zinc-300 bg-white p-1" />
      <Input className="w-32 font-mono" value={value ?? ''} placeholder="#D70321" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ReferenceSelect({ to, value, onChange }: { to: string; value: string | null; onChange: (v: string) => void }) {
  const { locale } = useMe();
  const { data = [] } = useQuery({ queryKey: ['collection', to, locale], queryFn: () => get<{ id: string; title: string }[]>(`/collections/${to}${qs({ locale })}`) });
  return (
    <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Select —</option>
      {data.map((d) => (
        <option key={d.id} value={d.id}>
          {d.title}
        </option>
      ))}
    </Select>
  );
}

function FieldInput({ field, value, onChange, fallback }: { field: Field; value: any; onChange: (v: any) => void; fallback?: any }) {
  const ph = typeof fallback === 'string' ? fallback : undefined;
  switch (field.type) {
    case 'text':
    case 'url':
      return <Input value={value ?? ''} placeholder={ph ?? (field.type === 'url' ? 'https://… or /path' : undefined)} maxLength={'maxLength' in field ? field.maxLength : undefined} onChange={(e) => onChange(e.target.value)} />;
    case 'textarea':
      return <Textarea rows={Math.min(10, Math.max(2, String(value ?? ph ?? '').split('\n').length + 1))} value={value ?? ''} placeholder={ph} onChange={(e) => onChange(e.target.value)} />;
    case 'richtext':
      return <RichText value={value ?? ''} onChange={onChange} placeholder={ph} />;
    case 'image':
      return <ImageInput value={value} onChange={onChange} />;
    case 'boolean':
      return <Switch checked={Boolean(value)} onChange={onChange} />;
    case 'number':
      return <Input type="number" className="w-40" value={value ?? ''} min={field.min} max={field.max} step={field.step} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
    case 'color':
      return <ColorInput value={value} onChange={onChange} />;
    case 'select':
      return (
        <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case 'reference':
      return <ReferenceSelect to={field.to} value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function itemTitle(field: ListField | BlocksField, item: Doc, i: number) {
  const label = field.type === 'list' ? (field.itemLabel ? item[field.itemLabel] : null) : (field.blocks[item._type]?.label ?? item._type);
  const extra = field.type === 'blocks' && item.title ? ` — ${String(item.title).replace(/\n/g, ' ')}` : '';
  return `${i + 1}. ${String(label || 'Item').replace(/\n/g, ' ')}${extra}`;
}

function Repeater({ field, value, onChange, fallback }: { field: ListField | BlocksField; value: Doc[] | null; onChange: (v: Doc[]) => void; fallback?: Doc[] }) {
  const items: Doc[] = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState<string | null>(null);
  const subFields = (item: Doc) => (field.type === 'list' ? field.fields : (field.blocks[item._type]?.fields ?? []));
  const move = (i: number, d: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    onChange(next);
  };
  const add = (type?: string) => {
    const item: Doc = { _id: newItemId(), ...(type ? { _type: type } : {}) };
    onChange([...items, item]);
    setOpen(item._id);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const fb = fallback?.find((f) => f._id === item._id);
        const isOpen = open === item._id;
        return (
          <div key={item._id ?? i} className="rounded-lg border border-zinc-200 bg-zinc-50/60">
            <div className="flex items-center gap-1 px-3 py-2">
              <button type="button" className="flex flex-1 items-center gap-2 text-left text-sm font-medium" onClick={() => setOpen(isOpen ? null : item._id)}>
                <ChevronDown className={cn('size-4 transition', !isOpen && '-rotate-90')} />
                <span className="truncate">{itemTitle(field, { ...fb, ...item }, i)}</span>
              </button>
              <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                <ArrowUp className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" disabled={i === items.length - 1} onClick={() => move(i, 1)} title="Move down">
                <ArrowDown className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" title="Duplicate" onClick={() => onChange([...items.slice(0, i + 1), { ...item, _id: newItemId() }, ...items.slice(i + 1)])}>
                <Copy className="size-3.5" />
              </Button>
              <Button size="sm" variant="ghost" title="Remove" onClick={() => window.confirm('Remove this item?') && onChange(items.filter((_, k) => k !== i))}>
                <Trash2 className="size-3.5 text-red-600" />
              </Button>
            </div>
            {isOpen ? (
              <div className="space-y-4 border-t border-zinc-200 bg-white p-4">
                <FieldList fields={subFields(item)} value={item} fallback={fb} onChange={(v) => onChange(items.map((x, k) => (k === i ? { ...v, _id: item._id, ...(item._type ? { _type: item._type } : {}) } : x)))} />
              </div>
            ) : null}
          </div>
        );
      })}
      {'max' in field && field.max && items.length >= field.max ? null : field.type === 'list' ? (
        <Button size="sm" variant="secondary" onClick={() => add()}>
          <Plus className="size-3.5" /> Add item
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          {Object.entries(field.blocks).map(([type, def]) => (
            <Button key={type} size="sm" variant="secondary" onClick={() => add(type)}>
              <Plus className="size-3.5" /> {def.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow({ field, children, translating }: { field: Field; children: ReactNode; translating: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label className="label mb-0">{field.label}</label>
        {translating && !isLocalized(field) && !isContainer(field) ? (
          <span title="Shared by all languages">
            <Globe2 className="size-3.5 text-zinc-400" />
          </span>
        ) : null}
        {field.required ? <span className="text-xs text-brand">*</span> : null}
      </div>
      {children}
      {field.help ? <p className="mt-1 text-xs text-zinc-500">{field.help}</p> : null}
    </div>
  );
}

export function FieldList({ fields, value, onChange, fallback, translating = false }: { fields: Field[]; value: Doc; onChange: (v: Doc) => void; fallback?: Doc | null; translating?: boolean }) {
  return (
    <>
      {fields.map((f) => (
        <FieldRow key={f.key} field={f} translating={translating}>
          {isContainer(f) ? (
            <Repeater field={f} value={value?.[f.key]} fallback={fallback?.[f.key]} onChange={(v) => onChange({ ...value, [f.key]: v })} />
          ) : (
            <FieldInput field={f} value={value?.[f.key]} fallback={fallback?.[f.key]} onChange={(v) => onChange({ ...value, [f.key]: v })} />
          )}
        </FieldRow>
      ))}
    </>
  );
}

/** Groups fields by `group` into collapsible cards. */
export function ContentForm({ fields, value, onChange, fallback, translating }: { fields: Field[]; value: Doc; onChange: (v: Doc) => void; fallback?: Doc | null; translating?: boolean }) {
  const groups = new Map<string, Field[]>();
  for (const f of fields) {
    const g = f.group ?? 'Content';
    groups.set(g, [...(groups.get(g) ?? []), f]);
  }
  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([g, fs]) => (
        <details key={g} open={g !== 'SEO'} className="card group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 font-semibold">
            {g}
            <span className="flex items-center gap-2">
              {g === 'SEO' ? <Badge>search & sharing</Badge> : null}
              <ChevronDown className="size-4 text-zinc-400 transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="space-y-5 border-t border-zinc-100 p-5">
            <FieldList fields={fs} value={value} onChange={onChange} fallback={fallback} translating={translating} />
          </div>
        </details>
      ))}
    </div>
  );
}
