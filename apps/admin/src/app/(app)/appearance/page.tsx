'use client';

import { ArrowDown, ArrowUp, ExternalLink, RotateCcw, Save, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { COLOR_PALETTES, defaultTheme, HOME_SECTIONS, type HomeSectionKey, type Theme } from '@app/shared/theme';
import { ColorInput } from '@/components/content-form';
import { ImageInput, uploadFiles } from '@/components/media-picker';
import { Button, Card, Field, Input, Loading, PageHeader, Select, Switch, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useSaveSetting, useSettings } from '@/lib/settings';
import { cn } from '@/lib/utils';

const COLOR_LABELS: Record<keyof Theme['colors'], [string, string]> = {
  bg: ['Background', 'Page background'],
  accent: ['Accent', 'Main brand color: titles, header panel, buttons'],
  secondary: ['Secondary', 'Gold: menu button, button text, highlights'],
  textAlt: ['Text on images', 'Hero titles over photos'],
  accentDark: ['Accent dark', 'Darker accent: error messages and form errors'],
  logo: ['Logo', 'Color of the text logo and letter mark'],
  navLinks: ['Top navigation', 'Home, Our pizzas, Our story, Contact at the top of the page'],
  menuLinks: ['Menu links', 'Links in the full-screen navigation'],
  footerLinks: ['Footer links', 'Social links, page links and legal links at the bottom'],
};
/** Ready-made palettes: one click fills in every color below (still editable, applied on Save). */
function PalettePicker({ colors, onPick }: { colors: Theme['colors']; onPick: (c: Theme['colors']) => void }) {
  const same = (a: Theme['colors'], b: Theme['colors']) => (Object.keys(b) as (keyof Theme['colors'])[]).every((k) => a[k]?.toLowerCase() === b[k].toLowerCase());
  return (
    <div className="mb-6 border-b border-zinc-100 pb-6">
      <p className="label">Color palettes</p>
      <p className="mb-3 text-xs text-zinc-500">Pick a palette to fill in all colors at once, then fine-tune any color below. Nothing changes on the website until you save.</p>
      <div className="flex flex-wrap gap-3">
        {COLOR_PALETTES.map((p, i) => {
          const active = same(colors, p.colors);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.colors)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-3 rounded-lg border bg-white px-3 py-2 text-left text-sm transition hover:border-brand',
                active ? 'border-brand ring-2 ring-brand/30' : 'border-zinc-200',
              )}
            >
              <span className="flex overflow-hidden rounded-md border border-zinc-200">
                {[p.colors.bg, p.colors.accent, p.colors.secondary, p.colors.accentDark, p.colors.textAlt].map((c, j) => (
                  <span key={j} className="size-5" style={{ background: c }} />
                ))}
              </span>
              <span>
                <span className="font-medium">{p.name}</span>
                {i === 0 ? <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 uppercase">default</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Small caption above each part of the preview. */
function PreviewCaption({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{children}</p>;
}

/** Mock of the website in page order, so each color can be seen where it is used. */
function ColorPreview({ colors: c, logoText }: { colors: Theme['colors']; logoText: string }) {
  const ribbon = 'polygon(100% 1%, 92% 50%, 100% 100%, 0 100%, 8% 50%, 0 0)';
  return (
    <div className="space-y-4" aria-label="Preview">
      <div>
        <PreviewCaption>Page</PreviewCaption>
        <div className="overflow-hidden rounded-xl border border-zinc-200 font-black uppercase" style={{ background: c.bg }}>
          {/* Hero photo with the top navigation and the logo panel over it */}
          <div className="relative h-40" style={{ background: 'linear-gradient(140deg, #b07a52 0%, #d9a877 38%, #7a4b31 72%, #4a2e22 100%)' }}>
            <div className="flex justify-between px-2.5 pt-2 text-[9px] tracking-wide" style={{ color: c.navLinks }}>
              <span className="flex gap-2">
                <span className="border-b pb-px" style={{ borderColor: c.navLinks }}>
                  Home
                </span>
                <span>Our pizzas</span>
              </span>
              <span className="flex gap-2">
                <span>Our story</span>
                <span>Contact</span>
              </span>
            </div>
            <div className="absolute top-0 left-1/2 w-20 -translate-x-1/2 px-2 pt-1.5 pb-2 text-center" style={{ background: c.accent }}>
              <div className="mx-auto mb-1 h-0.5 w-6" style={{ background: c.secondary }} />
              <span className="text-sm leading-none tracking-tight" style={{ color: c.logo }}>
                {logoText}
              </span>
            </div>
            <p className="absolute inset-x-0 bottom-3 text-center text-xl leading-none" style={{ color: c.textAlt }}>
              Pizza is the heart
            </p>
          </div>
          {/* Page content */}
          <p className="px-4 pt-4 text-center text-2xl leading-none" style={{ color: c.accent }}>
            Made with fire
          </p>
          <div className="flex justify-center py-3">
            <span className="px-5 py-1.5 text-xs" style={{ background: c.accent, color: c.secondary, clipPath: ribbon }}>
              Book a table
            </span>
          </div>
          <div className="mx-3 rounded-lg px-3 py-2 text-center text-[10px] normal-case" style={{ background: c.accentDark, color: c.bg }}>
            Please check the highlighted fields
          </div>
          {/* Footer */}
          <div className="mt-3 flex justify-center gap-3 border-t px-3 py-3 text-[10px]" style={{ color: c.footerLinks, borderColor: `${c.footerLinks}55` }}>
            <span>Instagram</span>
            <span>Our pizzas</span>
            <span>Privacy</span>
          </div>
        </div>
      </div>
      <div>
        <PreviewCaption>Menu</PreviewCaption>
        <div className="rounded-xl px-4 pt-2.5 pb-4 text-center font-black uppercase" style={{ background: c.accent }}>
          <div className="mx-auto mb-3 h-0.5 w-6" style={{ background: c.secondary }} />
          <div className="space-y-0.5 text-lg leading-tight" style={{ color: c.menuLinks }}>
            <p>Home</p>
            <p>Our pizzas</p>
            <p>Our story</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const SECTION_LABELS: Record<HomeSectionKey, string> = {
  hero: 'Hero (photo + big title)',
  intro: 'Intro paragraph',
  cards: 'Photo cards',
  description: 'Description title + paragraph',
  banners: 'Banners (Our locations · Book a table)',
  sticky: 'Sticky photo with seal',
  showcase: 'Product showcase',
  award: 'Award',
};

function FontPicker({ label, value, onChange }: { label: string; value: Theme['fonts']['display']; onChange: (v: Theme['fonts']['display']) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(files: File[]) {
    setBusy(true);
    try {
      const items = await uploadFiles(files, 'fonts');
      const woff2 = items.find((i) => i.url.endsWith('.woff2'))?.url ?? value.woff2;
      const woff = items.find((i) => i.url.endsWith('.woff'))?.url ?? value.woff;
      onChange({ ...value, woff2, woff });
      toast.success('Font uploaded');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
      <p className="font-medium">{label}</p>
      <Field label="Family name" hint="Any name; used only inside the site's CSS.">
        <Input value={value.family} onChange={(e) => onChange({ ...value, family: e.target.value })} />
      </Field>
      <Field label="Fallback fonts">
        <Input value={value.fallback} onChange={(e) => onChange({ ...value, fallback: e.target.value })} />
      </Field>
      <p className="truncate font-mono text-xs text-zinc-500">{value.woff2 ?? value.woff ?? 'No file'}</p>
      <input
        ref={input}
        type="file"
        accept=".woff2,.woff,.ttf,.otf"
        multiple
        hidden
        onChange={(e) => {
          // Copy the files, then clear the input so picking the same file again still triggers an upload.
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) void upload(files);
        }}
      />
      <Button size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
        <Upload className="size-4" /> Upload .woff2 / .woff
      </Button>
    </div>
  );
}

export default function AppearancePage() {
  const { data, isLoading } = useSettings();
  const save = useSaveSetting('theme');
  const [t, setT] = useState<Theme | null>(null);
  useEffect(() => {
    if (data) setT(data.theme);
  }, [data]);
  if (isLoading || !t) return <Loading />;
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => setT({ ...t, [k]: v });
  const sections = t.layout.homeSections.length ? t.layout.homeSections : HOME_SECTIONS.map((key) => ({ key, visible: true }));
  const moveSection = (i: number, d: number) => {
    const next = [...sections];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x!);
    set('layout', { ...t.layout, homeSections: next });
  };
  const web = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

  return (
    <div className="pb-24">
      <PageHeader
        title="Appearance"
        description="Colors, fonts, logo, layout and motion of the public website. The Classic palette is the default design."
        actions={
          <>
            <a href={web} target="_blank" rel="noreferrer">
              <Button variant="secondary">
                <ExternalLink className="size-4" /> Open website
              </Button>
            </a>
            <Button variant="secondary" onClick={() => window.confirm('Reset all appearance settings to the default design?') && setT(defaultTheme)}>
              <RotateCcw className="size-4" /> Reset to default
            </Button>
          </>
        }
      />
      <div className="space-y-5">
        <Card title="Colors">
          <PalettePicker colors={t.colors} onPick={(colors) => set('colors', { ...colors })} />
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="grid gap-5 sm:grid-cols-2">
              {(Object.keys(COLOR_LABELS) as (keyof Theme['colors'])[]).map((k) => (
                <Field key={k} label={COLOR_LABELS[k][0]} hint={COLOR_LABELS[k][1]}>
                  <ColorInput value={t.colors[k]} onChange={(v) => set('colors', { ...t.colors, [k]: v })} />
                </Field>
              ))}
            </div>
            <ColorPreview colors={t.colors} logoText={(t.logo.mode === 'text' && t.logo.text.trim()) || 'Logo'} />
          </div>
        </Card>

        <Card title="Logo & icon">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <Field label="Logo type">
                <Select value={t.logo.mode} onChange={(e) => set('logo', { ...t.logo, mode: e.target.value as Theme['logo']['mode'] })}>
                  <option value="text">Text logo — your name + a letter mark (animated)</option>
                  <option value="image">Image logo — upload a logo + a compact mark</option>
                </Select>
              </Field>
              {t.logo.mode === 'text' ? (
                <>
                  <Field
                    label="Logo text"
                    hint={`Shown like the current logo, in the display font and the “Logo” color. Press Enter for a second or third line. Empty = the site name${data?.site.name ? ` (${data.site.name})` : ''}.`}
                  >
                    <Textarea
                      rows={2}
                      maxLength={60}
                      className="font-semibold uppercase"
                      value={t.logo.text}
                      placeholder="LOGO"
                      onChange={(e) => set('logo', { ...t.logo, text: e.target.value.split('\n').slice(0, 3).join('\n') })}
                    />
                  </Field>
                  <Field
                    label="Letter mark"
                    hint="1–2 characters shown when the header shrinks. If they are in the name, the other letters slide away and the mark glides to the middle; otherwise it fades in. Empty = the first letter of the logo text."
                  >
                    <Input
                      maxLength={2}
                      className="w-24 text-center font-semibold uppercase"
                      value={t.logo.mark}
                      placeholder="L"
                      onChange={(e) => set('logo', { ...t.logo, mark: e.target.value.replace(/\s/g, '') })}
                    />
                  </Field>
                </>
              ) : t.logo.mode === 'image' ? (
                <>
                  <Field label="Logo (transparent PNG or WebP)">
                    <ImageInput value={t.logo.image} onChange={(v) => set('logo', { ...t.logo, image: v })} />
                  </Field>
                  <Field label="Compact mark (shown when the header shrinks)" hint="Optional — uses the main logo if empty.">
                    <ImageInput value={t.logo.compactImage} onChange={(v) => set('logo', { ...t.logo, compactImage: v })} />
                  </Field>
                </>
              ) : (
                <p className="text-sm text-zinc-500">The text logo and letter mark use the “Logo” color above.</p>
              )}
            </div>
            <Field label="Favicon (square PNG, at least 192 × 192)">
              <ImageInput value={t.favicon} onChange={(v) => set('favicon', v)} />
            </Field>
          </div>
        </Card>

        <Card title="Typography">
          <div className="grid gap-5 md:grid-cols-2">
            <FontPicker label="Display font (titles, menu, most text)" value={t.fonts.display} onChange={(v) => set('fonts', { ...t.fonts, display: v })} />
            <FontPicker label="Regular font (legal texts, form fields)" value={t.fonts.regular} onChange={(v) => set('fonts', { ...t.fonts, regular: v })} />
          </div>
        </Card>

        <Card title="Layout">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="Corner radius (rem)" hint="Cards, images, panels. Default: 2">
                <Input type="number" step={0.25} min={0} max={8} value={t.radius} onChange={(e) => set('radius', Number(e.target.value))} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                {(['mobileWidth', 'tabletWidth', 'desktopWidth'] as const).map((k) => (
                  <Field key={k} label={`${k.replace('Width', '')} width (vw)`}>
                    <Input type="number" min={70} max={100} value={t.grid[k]} onChange={(e) => set('grid', { ...t.grid, [k]: Number(e.target.value) })} />
                  </Field>
                ))}
              </div>
              <Switch checked={t.layout.showTopNav} onChange={(v) => set('layout', { ...t.layout, showTopNav: v })} label="Desktop top navigation" description="Home · Our pizzas … Our story · Contact" />
              <Field label="Language switcher">
                <Select value={t.layout.localeSwitcherPosition} onChange={(e) => set('layout', { ...t.layout, localeSwitcherPosition: e.target.value as any })}>
                  <option value="top-left">Top navigation — left</option>
                  <option value="top-right">Top navigation — right</option>
                  <option value="hidden">Hidden (still in the menu)</option>
                </Select>
              </Field>
              <Field label="Cart button">
                <Select value={t.layout.cartButtonPosition} onChange={(e) => set('layout', { ...t.layout, cartButtonPosition: e.target.value as any })}>
                  <option value="bottom-right">Floating pill, bottom right (appears when the cart has items)</option>
                  <option value="top-right">In the top navigation</option>
                </Select>
              </Field>
            </div>
            <div>
              <p className="label">Home page sections</p>
              <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {sections.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-2 px-3 py-2">
                    <Switch checked={s.visible} onChange={(v) => set('layout', { ...t.layout, homeSections: sections.map((x) => (x.key === s.key ? { ...x, visible: v } : x)) })} />
                    <span className="flex-1 text-sm">{SECTION_LABELS[s.key]}</span>
                    <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => moveSection(i, -1)}>
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" disabled={i === sections.length - 1} onClick={() => moveSection(i, 1)}>
                      <ArrowDown className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        <Card title="Motion">
          <div className="grid gap-5 md:grid-cols-2">
            <Switch checked={t.motion.intro} onChange={(v) => set('motion', { ...t.motion, intro: v })} label="Intro animation" description="Logo rises and shrinks into the header on first visit." />
            <Switch checked={t.motion.pageTransitions} onChange={(v) => set('motion', { ...t.motion, pageTransitions: v })} label="Page transitions" description="Red panel wipe between pages." />
            <Switch checked={t.motion.smoothScroll} onChange={(v) => set('motion', { ...t.motion, smoothScroll: v })} label="Smooth scrolling" />
            <Field label="Smooth scroll duration (s)">
              <Input type="number" step={0.1} min={0.2} max={3} value={t.motion.smoothScrollDuration} onChange={(e) => set('motion', { ...t.motion, smoothScrollDuration: Number(e.target.value) })} />
            </Field>
            <Switch checked={t.motion.customCursor} onChange={(v) => set('motion', { ...t.motion, customCursor: v })} label="Custom cursor" description="Desktop only." />
            <Switch checked={t.motion.respectReducedMotion} onChange={(v) => set('motion', { ...t.motion, respectReducedMotion: v })} label="Respect “reduce motion”" description="Turns off smooth scroll and page transitions for visitors who ask for less motion." />
          </div>
        </Card>

        <Card title="Custom CSS" description="Advanced: appended after the theme on every page.">
          <Textarea className="min-h-40 font-mono text-xs" value={t.customCss} onChange={(e) => set('customCss', e.target.value)} placeholder=".footer { … }" />
        </Card>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/90 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-7xl justify-end px-4 py-3 lg:px-8">
          <Button onClick={() => save.mutate(t)} loading={save.isPending}>
            <Save className="size-4" /> Save appearance
          </Button>
        </div>
      </div>
    </div>
  );
}
