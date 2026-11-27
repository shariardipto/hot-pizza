'use client';

import { TLink } from '@/components/nav/TLink';
import { LinkLabel } from '@/components/ui/LinkLabel';
import { CartLink } from '@/components/commerce/CartLink';
import { useSite, useT } from '@/lib/site';
import { LocaleSwitcher } from './LocaleSwitcher';

/** Desktop top navigation (hidden < 960px, the menu takes over). Same four links as the original. */
export function Navbar() {
  const t = useT();
  const { settings } = useSite();
  const { features, theme, locales } = settings;
  const showLang = features.languageSwitcher && locales.length > 1;
  const lang = showLang ? theme.layout.localeSwitcherPosition : 'hidden';
  const cartInNav = features.ordering && theme.layout.cartButtonPosition === 'top-right';

  return (
    <header className="fixed top-0 z-20 flex w-screen justify-between p-offset text-24 text-nav-links uppercase [--link-color:var(--c-nav-links)] max-md:hidden">
      <nav className="flex gap-40" aria-label="Primary">
        <TLink href="/">
          <LinkLabel text={t('navHome', 'Home')} />
        </TLink>
        <TLink href="/products">
          <LinkLabel text={t('navProducts', 'Products')} />
        </TLink>
        {lang === 'top-left' && <LocaleSwitcher />}
      </nav>
      <nav className="flex gap-40" aria-label="Secondary">
        {lang === 'top-right' && <LocaleSwitcher />}
        <TLink href="/about">
          <LinkLabel text={t('navAbout', 'Our history')} />
        </TLink>
        <TLink href="/contact">
          <LinkLabel text={t('navContact', 'Contact')} />
        </TLink>
        {cartInNav && <CartLink />}
      </nav>
    </header>
  );
}
