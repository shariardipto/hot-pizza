'use client';

import { usePathname } from 'next/navigation';
import { LinkLabel } from '@/components/ui/LinkLabel';
import { cx } from '@/lib/cx';
import { localizePath, useSite } from '@/lib/site';

/** "EN · ES" switcher styled like the original nav links. Full page load so all content re-renders in the new language. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, settings } = useSite();
  const pathname = usePathname() || '/';
  const codes = settings.locales.map((l) => l.code);
  const first = pathname.split('/')[1] ?? '';
  const rest = codes.includes(first) ? pathname.slice(first.length + 1) || '/' : pathname;

  return (
    <div className={cx('locales-switch', className)} style={{ display: 'flex', gap: '1.2em' }}>
      {settings.locales.map((l) => (
        <a
          key={l.code}
          href={localizePath(rest, l.code, settings.defaultLocale)}
          hrefLang={l.code}
          lang={l.code}
          aria-current={l.code === locale ? 'true' : undefined}
          className={cx({ 'nuxt-link-exact-active': l.code === locale })}
          title={l.nativeName}
        >
          <LinkLabel text={l.code.split('-')[0]!.toUpperCase()} />
        </a>
      ))}
    </div>
  );
}
