'use client';

import { useId, type CSSProperties } from 'react';
import { cx } from '@/lib/cx';
import { useSite } from '@/lib/site';

/*
 * Brand graphics. Same boxes, colors and animations as the original artwork; the shapes are generic (a pizza slice)
 * and every text comes from the admin: the letter mark (Appearance → Logo), the site name and the seal texts
 * (Texts & footer → Seal). The display font is the theme's (--ff-base).
 */

/** Pizza slice in a 34 × 20 box: crust on top, slice pointing down, three toppings cut out. */
const SLICE =
  'M3.5 0H30.5A3 3 0 0 1 30.5 6H3.5A3 3 0 0 1 3.5 0Z' +
  'M4 7.5H30L17 20Z' +
  'M10.6 10a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0Z' +
  'M19.4 10.4a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0-3.8 0Z' +
  'M15.4 14.6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0Z';

/** Cap height of the display font as a share of the font size (Oswald with the theme's size-adjust). */
const CAP = 0.72;
/** Average width of an upper-case letter as a share of the font size (used to fit seal texts to their arc). */
const LETTER = 0.45;
const fontStyle: CSSProperties = { fontFamily: 'var(--ff-base)' };

function useMarkLetter() {
  const { settings } = useSite();
  const logo = settings.theme.logo;
  const fromText = (logo.text?.trim() || settings.site.name).replace(/\s/g, '').charAt(0);
  return ((logo.mode === 'text' && logo.mark?.trim()) || fromText || 'P').toUpperCase().slice(0, 2);
}

/** Small brand mark that pops in when scrolled into view (toggles `is-inview`). */
export function BrandIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={cx(
        'w-[max(2.2rem,min(2.2vw,3.4rem))] will-change-transform transform-[scale(0)] [transition:transform_1s_cubic-bezier(0.165,0.84,0.44,1)] inview:transform-[scale(1)]',
        className,
      )}
      style={style}
      data-observe=""
      width="34"
      height="20"
      viewBox="0 0 34 20"
      fill="none"
      aria-hidden="true"
    >
      <path d={SLICE} fillRule="evenodd" style={{ fill: 'var(--text-color)' }} />
    </svg>
  );
}

/** Slice + letter mark, drawn in a 94 × 127 box (the monogram's original size), placed at (x, y) with a scale. */
function MarkArt({ letter, x = 0, y = 0, scale = 1 }: { letter: string; x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d={SLICE} fillRule="evenodd" transform="translate(17 0) scale(1.765)" style={{ fill: 'var(--svg-fill)' }} />
      <text
        x="47"
        y="124"
        textAnchor="middle"
        fontSize="118"
        style={{ ...fontStyle, fill: 'var(--svg-fill)' }}
        {...(letter.length > 1 ? { textLength: 90, lengthAdjust: 'spacingAndGlyphs' } : {})}
      >
        {letter}
      </text>
    </g>
  );
}

export function BrandMark({ className, fill = 'var(--c-accent)' }: { className?: string; fill?: string }) {
  const letter = useMarkLetter();
  const { settings } = useSite();
  return (
    <svg className={className} style={{ '--svg-fill': fill } as CSSProperties} width="94" height="127" viewBox="0 0 94 127" fill="none" role="img" aria-label={settings.site.name}>
      <MarkArt letter={letter} />
    </svg>
  );
}

/** Text along an arc of a circle. `top` arcs run clockwise over the top, others left → right along the bottom. */
function ArcText({ id, text, cx: x, cy: y, r, from, to, band, top }: { id: string; text: string; cx: number; cy: number; r: number; from: number; to: number; band: number; top: boolean }) {
  const rad = (a: number) => (a * Math.PI) / 180;
  const sweep = top ? (to - from + 360) % 360 : (from - to + 360) % 360;
  const length = (sweep / 360) * 2 * Math.PI * r;
  const size = Math.min(band / CAP, length / Math.max(text.length * LETTER, 1));
  // Top text sits outside its arc and bottom text inside, so both fill the same ring of width `band`.
  const radius = top ? r : r + size * CAP;
  const p = (a: number) => `${(x + radius * Math.cos(rad(a))).toFixed(2)} ${(y + radius * Math.sin(rad(a))).toFixed(2)}`;
  const d = `M${p(from)}A${radius} ${radius} 0 ${sweep > 180 ? 1 : 0} ${top ? 1 : 0} ${p(to)}`;
  return (
    <>
      <path id={id} d={d} fill="none" />
      <text fontSize={size.toFixed(2)} style={{ ...fontStyle, fill: 'var(--svg-fill)' }} textAnchor="middle">
        <textPath href={`#${id}`} startOffset="50%">
          {text.toUpperCase()}
        </textPath>
      </text>
    </>
  );
}

/** Seal with text above and below the mark (235 × 263, like the original). */
export function BrandSealSmall({ className, fill = 'var(--c-accent)' }: { className?: string; fill?: string }) {
  const { globals, settings } = useSite();
  const letter = useMarkLetter();
  const id = useId().replace(/:/g, '');
  return (
    <svg className={className} style={{ '--svg-fill': fill } as CSSProperties} width="235" height="263" viewBox="0 0 235 263" fill="none" role="img" aria-label={settings.site.name}>
      <ArcText id={`${id}t`} text={globals.sealTextTop ?? ''} cx={117.5} cy={131.5} r={86} from={200} to={340} band={30} top />
      <ArcText id={`${id}b`} text={globals.sealTextBottom ?? ''} cx={117.5} cy={131.5} r={86} from={150} to={30} band={30} top={false} />
      <MarkArt letter={letter} x={89} y={93} scale={0.6} />
    </svg>
  );
}

/** Large seal (346 × 348): the ring of text (.logo-seal__text) rotates slowly around the mark. */
export function BrandSealLarge({ className, fill = 'var(--c-accent)' }: { className?: string; fill?: string }) {
  const { globals, settings } = useSite();
  const letter = useMarkLetter();
  const id = useId().replace(/:/g, '');
  const ring = [globals.sealTextTop, globals.sealTextBottom].filter(Boolean).join(' · ');
  return (
    // In arbitrary variants "_" means a space, so the class's underscores are escaped (String.raw keeps the backslash).
    <svg
      className={cx(String.raw`[&_.logo-seal\_\_text]:origin-center [&_.logo-seal\_\_text]:animate-seal [&_.logo-seal\_\_text]:will-change-transform`, className)}
      style={{ '--svg-fill': fill } as CSSProperties}
      width="346"
      height="348"
      viewBox="0 0 346 348"
      fill="none"
      role="img"
      aria-label={settings.site.name}
    >
      <g className="logo-seal__text">
        <ArcText id={`${id}t`} text={ring} cx={173} cy={174} r={138} from={158} to={22} band={30} top />
        <ArcText id={`${id}b`} text={settings.site.name} cx={173} cy={174} r={138} from={140} to={40} band={30} top={false} />
      </g>
      <MarkArt letter={letter} x={136} y={124} scale={0.8} />
    </svg>
  );
}
