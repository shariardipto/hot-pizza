/**
 * Field definitions describe every editable piece of content.
 *
 * They drive three things at once:
 *  - the admin form builder (labels, widgets, grouping),
 *  - server-side validation (see `zod.ts`),
 *  - storage: localized values live in per-language translations, shared values once per entry (see `merge.ts`).
 */

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'image'
  | 'boolean'
  | 'number'
  | 'color'
  | 'select'
  | 'url'
  | 'reference'
  | 'list'
  | 'blocks';

interface FieldBase {
  key: string;
  label: string;
  help?: string;
  /** Stored per language. Defaults: text/textarea/richtext → true, everything else → false. */
  localized?: boolean;
  required?: boolean;
  /** Visual grouping in the admin form (e.g. "Hero", "SEO"). */
  group?: string;
}

export interface TextField extends FieldBase {
  type: 'text' | 'textarea' | 'url';
  maxLength?: number;
  placeholder?: string;
}
export interface RichTextField extends FieldBase {
  type: 'richtext';
}
export interface ImageField extends FieldBase {
  type: 'image';
}
export interface BooleanField extends FieldBase {
  type: 'boolean';
}
export interface NumberField extends FieldBase {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
}
export interface ColorField extends FieldBase {
  type: 'color';
}
export interface SelectField extends FieldBase {
  type: 'select';
  options: { value: string; label: string }[];
}
export interface ReferenceField extends FieldBase {
  type: 'reference';
  to: CollectionKey;
}
export interface ListField extends FieldBase {
  type: 'list';
  fields: Field[];
  /** Sub-field key used as the item title in the admin. */
  itemLabel?: string;
  max?: number;
}
export interface BlockDef {
  label: string;
  fields: Field[];
}
export interface BlocksField extends FieldBase {
  type: 'blocks';
  blocks: Record<string, BlockDef>;
}

export type Field =
  | TextField
  | RichTextField
  | ImageField
  | BooleanField
  | NumberField
  | ColorField
  | SelectField
  | ReferenceField
  | ListField
  | BlocksField;

export type CollectionKey = 'legal' | 'productType' | 'flavor' | 'product';
export type SingletonKey =
  | 'home'
  | 'about'
  | 'productsPage'
  | 'contact'
  | 'locationsPage'
  | 'globals'
  | 'ui';
export type ContentKey = SingletonKey | CollectionKey;

/** Stored image value. `url` is relative to the media origin (e.g. `/uploads/…`) or absolute (CDN). */
export interface ImageValue {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  mediaId?: string;
}

export function isLocalized(field: Field): boolean {
  if (field.localized !== undefined) return field.localized;
  return field.type === 'text' || field.type === 'textarea' || field.type === 'richtext';
}

export function isContainer(field: Field): field is ListField | BlocksField {
  return field.type === 'list' || field.type === 'blocks';
}

/** Common SEO fields appended to every routable content type. */
export const seoFields: Field[] = [
  { key: 'metaTitle', type: 'text', label: 'Meta title', group: 'SEO', maxLength: 70 },
  { key: 'metaDescription', type: 'textarea', label: 'Meta description', group: 'SEO', maxLength: 180 },
  { key: 'metaImage', type: 'image', label: 'Social share image', group: 'SEO' },
];
