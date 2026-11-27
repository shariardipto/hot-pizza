'use client';

import type { PublicLocation } from '@app/shared/api';
import type { ContactContent, LegalContent, LocationsPageContent } from '@app/shared/content';
import { formatPhone } from '@app/shared/schemas';
import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { BrandIcon } from '@/components/brand/Logos';
import { Footer } from '@/components/layout/Footer';
import { HeroSeal } from '@/components/sections/HeroSeal';
import { Container } from '@/components/ui/Container';
import { MotionLabel } from '@/components/ui/MotionLabel';
import { MotionTextChar } from '@/components/ui/MotionTextChar';
import { MotionTextLine } from '@/components/ui/MotionTextLine';
import { bus } from '@/lib/bus';
import { cx } from '@/lib/cx';
import { mdInline } from '@/lib/split';
import { useSite, useT } from '@/lib/site';
import { useUi } from '@/lib/store';

function useCursorReset() {
  useEffect(() => {
    bus.emit('updateCursor');
    bus.emit('resetCursor');
  }, []);
}

const hide = (v: boolean): CSSProperties | undefined => (v ? { display: 'none' } : undefined);

export function ContactSection({ title, description, className, children }: { title: string | null; description: string | null; className?: string; children?: ReactNode }) {
  return (
    <section className={cx('flex flex-col items-center justify-center md:max-lg:w-col-6', className)}>
      <MotionTextChar className="text-240 uppercase text-center mb-fluid-40" html={mdInline(title)} delay={1} tag="h1" />
      <MotionTextLine className="mb-fluid-80 lg:w-col-6 max-md:w-col-4 text-center" text={description} delay={2} />
      {children}
    </section>
  );
}

export function ContactPage({ page }: { page: ContactContent }) {
  useCursorReset();
  const { globals: g } = useSite();
  const t = useT();
  const isMobile = useUi((x) => x.isMobile);
  const email = g.email?.[0];
  const socials = [g.instagram?.[0], g.youtube?.[0], g.facebook?.[0]].filter((x) => x?.link);
  return (
    <main className="max-w-[100vw] flex flex-col items-center">
      <HeroSeal className="mb-fluid-120" image={page.image} />
      <ContactSection className="mb-fluid-120" title={page.contactTitle} description={page.contactDescription}>
        {email ? (
          <a className="uppercase text-center" href={email.link || `mailto:${email.value}`}>
            <MotionLabel className="text-110" text={email.label} style={hide(isMobile)} />
            <MotionTextChar className="mb-fluid-40" text={email.label} style={hide(!isMobile)} />
            <MotionTextChar className="text-110" text={t('emailLabel', 'Email')} style={hide(!isMobile)} />
          </a>
        ) : null}
      </ContactSection>
      <BrandIcon className="mb-fluid-120" />
      <ContactSection className="mb-fluid-120" title={page.followTitle} description={page.followDescription}>
        <div className="flex flex-col gap-y-gutter-double md:w-width md:flex-row md:flex-wrap md:justify-evenly">
          {socials.map((s0) => (
            <a key={s0!._id} className="flex flex-col items-center justify-center uppercase md:flex-[0_0_50%]" href={s0!.link!} target="_blank" rel="noopener">
              <MotionTextChar className="mb-fluid-20" text={s0!.value} />
              <MotionLabel className="text-110" text={s0!.label} />
            </a>
          ))}
        </div>
      </ContactSection>
      <Footer />
    </main>
  );
}

/** Opening hours as lines such as "Mon – Thu  12:00–15:30 · 19:00–23:00" (closed days left out). */
function hoursLines(hours: PublicLocation['openingHours'], locale: string): string[] {
  const day = (d: number) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 7 + d)));
  const order = [1, 2, 3, 4, 5, 6, 0];
  const key = (d: number) => (hours[String(d) as keyof typeof hours] ?? []).map((w) => `${w.open}–${w.close}`).join(' · ');
  const lines: string[] = [];
  for (let i = 0; i < order.length; ) {
    const k = key(order[i]!);
    let j = i;
    while (j + 1 < order.length && key(order[j + 1]!) === k) j++;
    if (k) lines.push(`${day(order[i]!)}${j > i ? ` – ${day(order[j]!)}` : ''}  ${k}`);
    i = j + 1;
  }
  return lines;
}

/** Our locations: the branches from Admin → Locations, listed in the same style as the original tasting page. */
export function LocationsPage({ page, locations }: { page: LocationsPageContent; locations: PublicLocation[] }) {
  useCursorReset();
  const { locale } = useSite();
  return (
    <main className="max-w-[100vw] flex flex-col items-center">
      <HeroSeal className="mt-fluid-200 mb-fluid-120 md:mt-fluid-200" image={page.image} />
      {/* No bottom margin: in the original, .container { margin: 0 auto } cancelled the sp-120 class here. */}
      <Container className="flex flex-col items-center justify-center">
        <MotionTextChar className="text-240 mb-fluid-120 text-center uppercase" html={mdInline(page.titleLarge)} />
        <div>
          {locations.map((l) => (
            <article
              key={l.id}
              className="mb-fluid-40 flex flex-col pb-fluid-40 text-center not-last:border-b not-last:border-b-accent max-md:w-col-4 md:max-lg:w-col-6 lg:w-col-8"
            >
              <span className="text-110 mb-fluid-14">{l.name}</span>
              <span>{[l.addressLine1, l.addressLine2, [l.postalCode, l.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
              {hoursLines(l.openingHours, locale).map((line) => (
                <span key={line}>{line}</span>
              ))}
              {l.phone ? <a href={`tel:${l.phone}`}>{formatPhone(l.phone)}</a> : null}
            </article>
          ))}
        </div>
      </Container>
      <Footer />
    </main>
  );
}

export function LegalPage({ page }: { page: LegalContent }) {
  useCursorReset();
  return (
    <main className="max-w-[100vw]">
      <Container>
        <section className="mb-fluid-40 pt-[calc(max(10rem,min(10vw,20rem))*2)] text-center whitespace-break-spaces">
          <h1 className="uppercase text-260">{page.title}</h1>
        </section>
        <h2 className="text-center text-35 mb-fluid-80">
          <span>{page.subtitle}</span>
        </h2>
      </Container>
      {/* Rich text from the CMS */}
      <Container
        className={cx(
          'max-w-col-6 font-regular',
          '[&_p]:mb-fluid-40 [&_li]:mb-[0.5em] [&_ul]:[list-style:inherit]',
          '[&_strong]:font-base [&_strong]:font-[400] [&_h3]:mb-fluid-20 [&_h3]:text-[1.4em] [&_h3]:font-[400]',
          '[&_a]:[text-decoration:underline_0.12em] [&_a:hover]:[text-decoration:none]',
        )}
      >
        <div dangerouslySetInnerHTML={{ __html: page.content ?? '' }} />
      </Container>
      <Footer />
    </main>
  );
}
