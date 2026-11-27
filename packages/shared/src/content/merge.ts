import type { BlocksField, Field, ListField } from './fields';
import { isContainer, isLocalized } from './fields';

/**
 * Content is stored in two parts:
 *  - `shared`:    values identical for every language (images, colors, flags, list structure + item ids)
 *  - `localized`: values per language (texts). For lists/blocks: `{ [listKey]: { [itemId]: {...localized subfields} } }`
 *
 * `splitContent` turns an edited, merged document into both parts; `mergeContent` rebuilds a merged document
 * for one language, falling back field-by-field to the default language.
 */

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Doc = Record<string, any>;

export interface ListItem {
  _id: string;
  _type?: string;
  [k: string]: any;
}

let counter = 0;
export function newItemId(): string {
  counter = (counter + 1) % 1679616;
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`;
}

function itemFields(field: ListField | BlocksField, item: ListItem): Field[] {
  if (field.type === 'list') return field.fields;
  return field.blocks[item._type ?? '']?.fields ?? [];
}

export function splitContent(fields: Field[], merged: Doc): { shared: Doc; localized: Doc } {
  const shared: Doc = {};
  const localized: Doc = {};
  for (const field of fields) {
    const value = merged?.[field.key];
    if (isContainer(field)) {
      const items: ListItem[] = Array.isArray(value) ? value : [];
      const sharedItems: ListItem[] = [];
      const localizedItems: Doc = {};
      for (const raw of items) {
        const item: ListItem = { ...raw, _id: raw?._id || newItemId() };
        const parts = splitContent(itemFields(field, item), item);
        sharedItems.push({ _id: item._id, ...(item._type ? { _type: item._type } : {}), ...parts.shared });
        if (Object.keys(parts.localized).length) localizedItems[item._id] = parts.localized;
      }
      shared[field.key] = sharedItems;
      localized[field.key] = localizedItems;
    } else if (value !== undefined) {
      (isLocalized(field) ? localized : shared)[field.key] = value;
    }
  }
  return { shared, localized };
}

function pick(primary: any, fallback: any): any {
  return primary !== undefined && primary !== null ? primary : fallback;
}

export function mergeContent(fields: Field[], shared: Doc = {}, localized: Doc = {}, fallback: Doc = {}): Doc {
  const out: Doc = {};
  for (const field of fields) {
    if (isContainer(field)) {
      const items: ListItem[] = Array.isArray(shared?.[field.key]) ? shared[field.key] : [];
      const loc = localized?.[field.key] ?? {};
      const fb = fallback?.[field.key] ?? {};
      out[field.key] = items.map((item) => ({
        ...mergeContent(itemFields(field, item), item, loc[item._id], fb[item._id]),
        _id: item._id,
        ...(item._type ? { _type: item._type } : {}),
      }));
    } else if (isLocalized(field)) {
      out[field.key] = pick(localized?.[field.key], fallback?.[field.key]) ?? null;
    } else {
      out[field.key] = shared?.[field.key] ?? null;
    }
  }
  return out;
}

/** Fraction of localized text fields that have a value in `localized` (0..1). Used for "translation progress". */
export function translationCoverage(fields: Field[], shared: Doc = {}, localized: Doc = {}): { filled: number; total: number } {
  let filled = 0;
  let total = 0;
  for (const field of fields) {
    if (isContainer(field)) {
      const items: ListItem[] = Array.isArray(shared?.[field.key]) ? shared[field.key] : [];
      for (const item of items) {
        const c = translationCoverage(itemFields(field, item), item, localized?.[field.key]?.[item._id]);
        filled += c.filled;
        total += c.total;
      }
    } else if (isLocalized(field)) {
      total += 1;
      const v = localized?.[field.key];
      if (v !== undefined && v !== null && v !== '') filled += 1;
    }
  }
  return { filled, total };
}
