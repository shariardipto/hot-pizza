'use client';

import { BrandMark } from '@/components/brand/Logos';
import { TLink } from '@/components/nav/TLink';
import { Container } from '@/components/ui/Container';
import { LinkLabel } from '@/components/ui/LinkLabel';
import { MotionTextChar } from '@/components/ui/MotionTextChar';
import { MotionTextLine } from '@/components/ui/MotionTextLine';
import { cx } from '@/lib/cx';
import { useSite, useT } from '@/lib/site';
import { useUi } from '@/lib/store';

/** Row of links. On phones the original's text size class only contributes its line-height (the font size is fluid). */
const menuRow = (isMobile: boolean) =>
  cx(
    'flex flex-row items-center justify-center self-center gap-gutter md:gap-gutter-double',
    'text-[length:max(1.6rem,min(1.6vw,2.4rem))] md:text-[length:max(2rem,min(2vw,3rem))] [&_a]:w-fit',
    isMobile && 'leading-[100%]',
  );
const footerLogo = 'w-[max(3rem,min(3vw,7rem))]';

export function Footer() {
  const { globals: g, settings } = useSite();
  const t = useT();
  const isMobile = useUi((x) => x.isMobile);
  const year = new Date().getFullYear();
  const socials = [g.instagram?.[0], g.youtube?.[0], g.facebook?.[0]].filter((x) => x?.link);

  return (
    <footer className="relative z-10 max-w-[100vw] overflow-hidden bg-bg pt-fluid-120 pb-fluid-40">
      {/* Links use the "Footer links" color (Admin → Appearance); headline, address and copyright use the accent color. */}
      <Container className="flex flex-col items-center justify-center text-footer-links">
        <div className={cx(menuRow(isMobile), 'mb-fluid-40')}>
          {socials.map((sx) => (
            <a key={sx!._id} className="uppercase" href={sx!.link!} target="_blank" rel="noopener">
              <LinkLabel color="var(--c-footer-links)" text={sx!.label} />
            </a>
          ))}
        </div>
        <div className="mb-fluid-60">
          <MotionTextChar className="text-110 text-accent text-center" text={g.footerSmallTextTop} />
          <MotionTextChar className="text-110 text-accent text-center mb-fluid-40" text={g.footerSmallTextRight} />
          {(g.footerTextMain ?? '').split('\n').map((line, i) => (
            <div key={i} className="flex items-center justify-center gap-gutter-double text-center text-accent uppercase">
              <MotionTextLine lineHeight="120%" delay={i + 3} text={line} />
            </div>
          ))}
        </div>
        <TLink href="/" className="mb-fluid-60" style={isMobile ? undefined : { display: 'none' }} aria-label={settings.site.name}>
          <BrandMark className={footerLogo} />
        </TLink>
        <div>
          <div className="max-md:flex max-md:w-width max-md:justify-center max-md:gap-gutter-double">
            <div className={cx(menuRow(isMobile), 'mb-fluid-60 uppercase')}>
              <TLink href="/products">
                <LinkLabel color="var(--c-footer-links)" text={t('navProducts', 'Products')} />
              </TLink>
              <TLink href="/about">
                <LinkLabel color="var(--c-footer-links)" text={t('footerHistory', 'History')} />
              </TLink>
              <TLink href="/" style={isMobile ? { display: 'none' } : undefined} aria-label={settings.site.name}>
                <BrandMark className={cx(footerLogo, 'transform-[translateY(-10%)]')} />
              </TLink>
              <TLink href="/contact">
                <LinkLabel color="var(--c-footer-links)" text={t('navContact', 'Contact')} />
              </TLink>
              <TLink href="/">
                <LinkLabel color="var(--c-footer-links)" text={t('navHome', 'Home')} />
              </TLink>
            </div>
          </div>
          <div className="mb-fluid-60 flex items-center justify-center gap-[1.2em] text-24 uppercase">
            <TLink href="/legal/privacy-policy">
              <LinkLabel color="var(--c-footer-links)" text={t('footerPrivacy', 'Privacy policy')} />
            </TLink>
            <TLink href="/legal/cookie-policy">
              <LinkLabel color="var(--c-footer-links)" text={t('footerCookies', 'Cookie policy')} />
            </TLink>
            <TLink href="/legal/legal-notice">
              <LinkLabel color="var(--c-footer-links)" text={t('footerLegalNotice', 'Legal notice')} />
            </TLink>
            {g.rightsLink ? (
              <a href={g.rightsLink} target="_blank" rel="noopener">
                <LinkLabel color="var(--c-footer-links)" text={t('footerRights', 'Data rights')} />
              </a>
            ) : null}
          </div>
          <div className="mb-fluid-60 text-center text-20 text-accent uppercase md:[&_br]:hidden">
            {t('footerCopyright', '© {year} {name}. All rights reserved.').replace('{year}', String(year)).replace('{name}', settings.site.name)}
          </div>
        </div>
      </Container>
    </footer>
  );
}
