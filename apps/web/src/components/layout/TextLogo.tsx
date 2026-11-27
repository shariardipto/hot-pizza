'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { cx } from '@/lib/cx';

/**
 * Text logo (Admin → Appearance → Logo type "Text logo"): the name in the display font, which collapses into its
 * letter mark exactly like the original artwork collapses into its crowned "M" — letters before the mark slide up,
 * letters after it slide down, and the mark glides to the middle of the small header box.
 *
 * It uses the original artwork's frame (972.69 × 337.5), so the header, the intro and the collapse keep the same
 * geometry, and everything is sized in container units, so it scales with whatever box it is in.
 */
const FRAME_W = 972.69;
const FRAME_H = 337.5;
/** Where the mark ends up when the header has collapsed (fractions of the frame), measured on the original. */
const MARK_TARGET = { x: 0.5, y: 0.66, height: 0.5 };
const LINE_HEIGHT = 0.86;
/** A line never gets taller than this share of the frame (each line of the original artwork is about 45%). */
const MAX_LINE = 0.45;
/** Stagger of the sliding letters, as in the original timeline (amount 0.1 s, from the end). */
const STAGGER = 0.1;

type Glyph = {
  ch: string;
  key: string;
  kind: 'up' | 'down' | 'mark' | 'space';
  delayIn: number;
  delayOut: number;
};

function layout(lines: string[], mark: string) {
  // Where the mark is in the text (first occurrence), if it is there at all.
  let at: { line: number; index: number } | null = null;
  for (let l = 0; l < lines.length && mark && !at; l++) {
    const i = lines[l]!.indexOf(mark);
    if (i >= 0) at = { line: l, index: i };
  }
  const half = (lines.join('').length || 1) / 2;
  let seen = 0;
  const rows: Glyph[][] = lines.map((line, l) => {
    const row: Glyph[] = [];
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (at && l === at.line && i === at.index) {
        row.push({ ch: mark, key: `${l}-${i}`, kind: 'mark', delayIn: 0, delayOut: 0 });
        i += mark.length - 1;
        seen += mark.length;
        continue;
      }
      const before = at ? l < at.line || (l === at.line && i < at.index) : seen < half;
      seen++;
      row.push({
        ch,
        key: `${l}-${i}`,
        kind: ch === ' ' ? 'space' : before ? 'up' : 'down',
        delayIn: 0,
        delayOut: 0,
      });
    }
    return row;
  });
  // Stagger inside each group: collapsing starts from the end of the group, expanding plays it back in reverse.
  for (const kind of ['up', 'down'] as const) {
    const group = rows.flat().filter((g) => g.kind === kind);
    group.forEach((g, i) => {
      const t = group.length > 1 ? i / (group.length - 1) : 0;
      g.delayIn = STAGGER * (1 - t);
      g.delayOut = STAGGER * t;
    });
  }
  return { rows, inText: Boolean(at) };
}

export function TextLogo({
  text,
  mark,
  collapsed,
  label,
}: {
  text: string;
  mark: string;
  collapsed: boolean;
  label: string;
}) {
  const lines = useMemo(
    () =>
      text
        .toUpperCase()
        .split(/\r?\n/)
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 3),
    [text],
  );
  const markText = (mark.trim() || lines.join('').replace(/\s/g, '').charAt(0)).toUpperCase().slice(0, 2);
  const { rows, inText } = useMemo(() => layout(lines, markText), [lines, markText]);
  const frame = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  // Width of the longest line in em, first estimated (condensed display font), then measured once fonts are loaded.
  const estimate = Math.max(1, ...lines.map((l) => l.length * 0.5));

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled) return;
      const ctx = document.createElement('canvas').getContext('2d');
      if (ctx) {
        const style = getComputedStyle(el);
        ctx.font = `${style.fontWeight} 100px ${style.fontFamily}`;
        // Letters are separate boxes (no kerning between them), so sum single glyphs.
        const em = Math.max(
          ...lines.map(
            (l) => [...l].reduce((w, ch) => w + ctx.measureText(ch === ' ' ? ' ' : ch).width, 0) / 100,
          ),
        );
        if (em > 0) el.style.setProperty('--em', String(em));
      }
      // Mark: move from its place in the name to the collapsed position (fractions of the frame, so it scales).
      const m = markRef.current;
      if (m && inText && el.offsetWidth && el.offsetHeight) {
        const cx = (m.offsetLeft + m.offsetWidth / 2) / el.offsetWidth;
        const cy = (m.offsetTop + m.offsetHeight / 2) / el.offsetHeight;
        const h = m.offsetHeight / el.offsetHeight;
        el.style.setProperty('--mx', `${((MARK_TARGET.x - cx) * 100).toFixed(3)}cqw`);
        el.style.setProperty('--my', `${((MARK_TARGET.y - cy) * 100).toFixed(3)}cqh`);
        el.style.setProperty('--ms', (MARK_TARGET.height / h).toFixed(4));
      }
    };
    measure();
    document.fonts?.ready.then(() => requestAnimationFrame(measure));
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [lines, inText, markText]);

  const fontSize = `min(calc(${MAX_LINE} * 100cqh / ${LINE_HEIGHT}), calc(0.92 * 100cqh / ${LINE_HEIGHT * Math.max(lines.length, 1)}), calc(0.96 * 100cqw / var(--em)))`;
  const ease = 'var(--ease-in-out-expo)';

  return (
    <div
      role="img"
      aria-label={label}
      className={cx('relative font-base text-(--c-logo)', collapsed && 'is-collapsed')}
    >
      {/* Invisible copy of the original artwork's box: the text logo takes exactly the space the artwork would. */}
      <svg
        aria-hidden="true"
        className="block"
        width={FRAME_W}
        height={FRAME_H}
        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
      />
      <div
        ref={frame}
        className="absolute inset-0 @container-size"
        style={{ '--em': estimate } as CSSProperties}
      >
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ fontSize, lineHeight: LINE_HEIGHT }}
          aria-hidden="true"
        >
          {rows.map((row, r) => (
            <div key={r} className="flex whitespace-pre">
              {row.map((g) =>
                g.kind === 'mark' ? (
                  <span
                    key={g.key}
                    ref={markRef}
                    className={cx('relative z-1 inline-block origin-center will-change-transform', collapsed && 'pointer-events-auto')}
                    style={{
                      transform: collapsed
                        ? 'translate3d(var(--mx, 0), var(--my, 0), 0) scale(var(--ms, 1))'
                        : 'none',
                      // Same timing as the original monogram: leaves after the letters, comes back before them.
                      transition: `transform 0.5s var(--ease-expo) ${collapsed ? 0.35 : 0.15}s`,
                    }}
                  >
                    {g.ch}
                  </span>
                ) : g.kind === 'space' ? (
                  <span key={g.key} className="inline-block">
                    {' '}
                  </span>
                ) : (
                  // Each letter slides inside its own clipped box (padding keeps accents from being cut).
                  <span key={g.key} className="my-[-0.1em] inline-block overflow-hidden py-[0.1em]">
                    <span
                      className="inline-block will-change-transform"
                      style={{
                        transform: collapsed
                          ? `translate3d(0, ${g.kind === 'up' ? '-110%' : '110%'}, 0)`
                          : 'none',
                        transition: `transform 0.5s ${ease} ${collapsed ? g.delayIn : g.delayOut}s`,
                      }}
                    >
                      {g.ch}
                    </span>
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
        {/* A mark that is not part of the name fades in on its own, where the collapsed mark sits. */}
        {!inText && (
          <span
            className={cx('absolute inline-block text-center whitespace-pre', collapsed && 'pointer-events-auto')}
            aria-hidden="true"
            style={{
              left: `${MARK_TARGET.x * 100}%`,
              top: `${MARK_TARGET.y * 100}%`,
              fontSize: `calc(${MARK_TARGET.height} * 100cqh / ${LINE_HEIGHT})`,
              lineHeight: LINE_HEIGHT,
              opacity: collapsed ? 1 : 0,
              transform: collapsed ? 'translate3d(-50%, -50%, 0)' : 'translate3d(-50%, -20%, 0)',
              transition: `opacity 0.5s var(--ease-expo) ${collapsed ? 0.35 : 0}s, transform 0.5s var(--ease-expo) ${collapsed ? 0.35 : 0}s`,
            }}
          >
            {markText}
          </span>
        )}
      </div>
    </div>
  );
}
