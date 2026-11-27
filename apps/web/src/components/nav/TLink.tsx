'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { bus } from '@/lib/bus';
import { cx } from '@/lib/cx';
import { beforeNavigate } from '@/lib/navigation';
import { useLocalePath } from '@/lib/site';
import { ui } from '@/lib/store';

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

/**
 * Internal link with the original page-transition choreography.
 * Adds `nuxt-link-active` / `nuxt-link-exact-active` classes (the original CSS relies on them).
 */
export function TLink({
  href,
  children,
  className,
  localized = true,
  ...rest
}: { href: string; children?: ReactNode; className?: string; localized?: boolean } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const router = useRouter();
  const pathname = norm(usePathname() || '/');
  const lp = useLocalePath();
  const target = localized ? lp(href) : href;
  const targetPath = norm(target.split(/[?#]/)[0]!);
  const exact = pathname === targetPath;
  const active = exact || (targetPath !== '/' && !/^\/[a-z]{2}(-[A-Za-z]+)?$/.test(targetPath) && pathname.startsWith(`${targetPath}/`));

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    rest.onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === '_blank') return;
    e.preventDefault();
    if (exact) {
      if (ui().isMenuOpen) bus.emit('CLOSE_MENU');
      return;
    }
    router.prefetch(target);
    beforeNavigate(target, (h) => router.push(h, { scroll: false }));
  }

  return (
    <a {...rest} href={target} className={cx(className, { 'nuxt-link-active': active, 'nuxt-link-exact-active': exact })} onClick={onClick}>
      {children}
    </a>
  );
}
