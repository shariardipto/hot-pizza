'use client';

import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  ExternalLink,
  FileText,
  Globe2,
  Image as ImageIcon,
  Languages,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu as MenuIcon,
  Package,
  Palette,
  Pizza,
  ScrollText,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Type,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Loading, Select } from '@/components/ui';
import { get } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { MeProvider, useMe, type Me } from '@/lib/me';
import { cn } from '@/lib/utils';

const NAV: { section: string; items: { href: string; label: string; icon: any; perm: string }[] }[] = [
  { section: 'Overview', items: [{ href: '/', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' }] },
  {
    section: 'Business',
    items: [
      { href: '/orders', label: 'Orders', icon: ShoppingBag, perm: 'orders.view' },
      { href: '/reservations', label: 'Reservations', icon: CalendarDays, perm: 'reservations.view' },
    ],
  },
  {
    section: 'Content',
    items: [
      { href: '/pages', label: 'Pages', icon: FileText, perm: 'content.edit' },
      { href: '/catalog', label: 'Catalog', icon: Package, perm: 'catalog.edit' },
      { href: '/texts', label: 'Texts & footer', icon: Type, perm: 'content.edit' },
      { href: '/media', label: 'Media library', icon: ImageIcon, perm: 'media.manage' },
      { href: '/languages', label: 'Languages', icon: Languages, perm: 'content.edit' },
    ],
  },
  {
    section: 'Setup',
    items: [
      { href: '/appearance', label: 'Appearance', icon: Palette, perm: 'theme.manage' },
      { href: '/markets', label: 'Markets & payments', icon: Globe2, perm: 'markets.manage' },
      { href: '/locations', label: 'Locations', icon: MapPin, perm: 'locations.manage' },
      { href: '/settings', label: 'Settings', icon: Settings, perm: 'settings.manage' },
      { href: '/users', label: 'Team', icon: Users, perm: 'users.manage' },
      { href: '/audit', label: 'Audit log', icon: ScrollText, perm: 'audit.view' },
    ],
  },
];

function Shell({ children }: { children: ReactNode }) {
  const { me, can, locale, setLocale, locales } = useMe();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  const mustSetUp2fa = me.twoFactorRequired && !me.user.twoFactorEnabled;
  useEffect(() => {
    if (mustSetUp2fa && pathname !== '/account') router.replace('/account?setup=2fa');
  }, [mustSetUp2fa, pathname, router]);

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {NAV.map((g) => {
        const items = g.items.filter((i) => can(i.perm));
        if (!items.length) return null;
        return (
          <div key={g.section}>
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{g.section}</p>
            {items.map((i) => {
              const active = i.href === '/' ? pathname === '/' : pathname.startsWith(i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={() => setOpen(false)}
                  className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition', active ? 'bg-brand/10 font-medium text-brand' : 'text-zinc-700 hover:bg-zinc-100')}
                >
                  <i.icon className="size-4" />
                  {i.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-gold">
            <Pizza className="size-5" aria-hidden="true" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Admin</p>
            <a href={webUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-brand">
              View website <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
        {nav}
        <div className="border-t border-zinc-100 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              title="Account & security"
              className={cn('-mx-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-0.5 hover:bg-zinc-100', pathname === '/account' && 'bg-zinc-100')}
            >
              <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase">
                {me.user.name.slice(0, 2)}
                {!me.user.twoFactorEnabled ? (
                  <ShieldAlert className={cn('absolute -right-1 -bottom-1 size-3.5 rounded-full bg-white', mustSetUp2fa ? 'text-amber-600' : 'text-zinc-400')} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium">{me.user.name}</span>
                <span className="block truncate text-xs capitalize text-zinc-500">{me.user.role}</span>
              </span>
            </Link>
            <button
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
              title="Sign out"
              onClick={async () => {
                await authClient.signOut();
                router.replace('/login');
              }}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
      {open ? <div className="fixed inset-0 z-30 bg-zinc-900/30 lg:hidden" onClick={() => setOpen(false)} /> : null}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/80 px-4 backdrop-blur lg:px-8">
          <button className="rounded-md p-1.5 hover:bg-zinc-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open navigation">
            <MenuIcon className="size-5" />
          </button>
          <div className="flex-1" />
          {locales.length > 1 && can('content.edit') ? (
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <Languages className="size-4" />
              Editing language
              <Select className="w-40 py-1" value={locale} onChange={(e) => setLocale(e.target.value)}>
                {locales.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName} ({l.code}){l.isDefault ? ' — default' : ''}
                    {l.enabled ? '' : ' — hidden'}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </header>
        <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => get<Me>('/me'), staleTime: 60_000 });
  if (isLoading || !data) return <Loading />;
  return (
    <MeProvider me={data}>
      <Shell>{children}</Shell>
    </MeProvider>
  );
}
