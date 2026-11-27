import { z } from 'zod';
import type { Field } from './fields';

export const imageValueSchema = z.object({
  url: z.string().min(1).max(2048),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  alt: z.string().max(300).optional(),
  mediaId: z.string().optional(),
});

export const hexColorSchema = z.string().regex(/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i, 'Use a hex color like #D70321');

function fieldSchema(field: Field): z.ZodType {
  let s: z.ZodType;
  switch (field.type) {
    case 'text':
    case 'textarea':
      s = z.string().max(field.maxLength ?? 20000);
      break;
    case 'url':
      s = z.string().max(2048);
      break;
    case 'richtext':
      s = z.string().max(500000);
      break;
    case 'image':
      s = imageValueSchema;
      break;
    case 'boolean':
      s = z.boolean();
      break;
    case 'number': {
      let n = z.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      s = n;
      break;
    }
    case 'color':
      s = hexColorSchema;
      break;
    case 'select':
      s = z.enum(field.options.map((o) => o.value) as [string, ...string[]]);
      break;
    case 'reference':
      s = z.string().min(1);
      break;
    case 'list': {
      const item = z.object({ _id: z.string().optional(), ...shape(field.fields) });
      let a = z.array(item);
      if (field.max !== undefined) a = a.max(field.max);
      s = a;
      break;
    }
    case 'blocks': {
      const variants = Object.entries(field.blocks).map(([type, def]) =>
        z.object({ _id: z.string().optional(), _type: z.literal(type), ...shape(def.fields) }),
      );
      s = z.array(variants.length === 1 ? variants[0]! : z.discriminatedUnion('_type', variants as any));
      break;
    }
  }
  return field.required ? s : s.nullable().optional();
}

function shape(fields: Field[]): Record<string, z.ZodType> {
  return Object.fromEntries(fields.map((f) => [f.key, fieldSchema(f)]));
}

/** Schema for a merged (single-language) document of the given fields. */
export function contentSchema(fields: Field[]) {
  return z.object(shape(fields));
}
