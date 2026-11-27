import { describe, expect, it } from 'vitest';
import { contentSchema, contentTypes, mergeContent, splitContent, translationCoverage } from '../content';

const about = contentTypes.about!.fields;

describe('content split / merge across languages', () => {
  const es = {
    heroTitleLarge: 'INNOVACIÓN',
    heroImage: { url: '/uploads/a.jpg', width: 10, height: 10 },
    chapters: [
      { _id: 'c1', _type: 'chapter', title: 'ASÍ EMPEZÓ', color: '#D70321', optimizeLegibility: true, secondary: false },
      { _id: 'i1', _type: 'image', image: { url: '/uploads/b.jpg' } },
    ],
  };

  it('stores shared values once and texts per language', () => {
    const { shared, localized } = splitContent(about, es);
    expect(shared.heroImage.url).toBe('/uploads/a.jpg');
    expect(shared.heroTitleLarge).toBeUndefined();
    expect(localized.heroTitleLarge).toBe('INNOVACIÓN');
    expect(shared.chapters[0]).toMatchObject({ _id: 'c1', _type: 'chapter', color: '#D70321' });
    expect(localized.chapters.c1.title).toBe('ASÍ EMPEZÓ');
  });

  it('falls back to the default language per field (including list items)', () => {
    const { shared, localized: esLoc } = splitContent(about, es);
    const enLoc = { heroTitleLarge: 'INNOVATION', chapters: {} };
    const merged = mergeContent(about, shared, enLoc, esLoc);
    expect(merged.heroTitleLarge).toBe('INNOVATION');
    expect(merged.chapters[0].title).toBe('ASÍ EMPEZÓ');
    expect(merged.chapters[0].color).toBe('#D70321');
    expect(merged.chapters[1]._type).toBe('image');
  });

  it('measures translation coverage', () => {
    const { shared } = splitContent(about, es);
    const c = translationCoverage(about, shared, { heroTitleLarge: 'X' });
    expect(c.filled).toBe(1);
    expect(c.total).toBeGreaterThan(5);
  });

  it('validates documents from the field definitions', () => {
    expect(contentSchema(about).safeParse(es).success).toBe(true);
    expect(contentSchema(about).safeParse({ ...es, chapters: [{ _type: 'chapter', color: 'red' }] }).success).toBe(false);
  });
});
