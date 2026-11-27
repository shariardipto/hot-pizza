'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { get } from './api';

export interface Me {
  user: { id: string; name: string; email: string; role: 'admin' | 'editor' | 'staff'; image: string | null; twoFactorEnabled: boolean };
  permissions: string[];
  /** Settings → Security → require two-factor for everyone. */
  twoFactorRequired: boolean;
  siteName: string;
}

export interface Locale {
  code: string;
  name: string;
  nativeName: string;
  enabled: boolean;
  isDefault: boolean;
  dir: string;
  translatedEntries: number;
  totalEntries: number;
}

const Ctx = createContext<{ me: Me; can: (p: string) => boolean; locale: string; setLocale: (l: string) => void; locales: Locale[] } | null>(null);

export function MeProvider({ me, children }: { me: Me; children: ReactNode }) {
  const { data: locales = [] } = useQuery({ queryKey: ['locales'], queryFn: () => get<Locale[]>('/locales'), enabled: me.permissions.includes('content.edit') });
  const def = locales.find((l) => l.isDefault)?.code ?? 'en';
  const [locale, setLocaleState] = useState<string>('');
  useEffect(() => {
    if (locale || !locales.length) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('admin.locale');
    } catch {
      /* ignore */
    }
    setLocaleState(saved && locales.some((l) => l.code === saved) ? saved : def);
  }, [locales, locale, def]);
  const setLocale = (l: string) => {
    setLocaleState(l);
    try {
      localStorage.setItem('admin.locale', l);
    } catch {
      /* ignore */
    }
  };
  return (
    <Ctx.Provider value={{ me, can: (p) => me.user.role === 'admin' || me.permissions.includes(p), locale: locale || def, setLocale, locales }}>{children}</Ctx.Provider>
  );
}

export function useMe() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMe outside provider');
  return v;
}
