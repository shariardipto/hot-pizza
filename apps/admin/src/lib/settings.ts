'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CommerceSettings, Features, SecuritySettings, Site, Theme } from '@app/shared/theme';
import { errorMessage, get, put } from './api';

export interface AllSettings {
  site: Site;
  theme: Theme;
  features: Features;
  commerce: CommerceSettings;
  security: SecuritySettings;
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => get<AllSettings>('/settings') });
}

export function useSaveSetting<K extends keyof AllSettings>(key: K) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (value: AllSettings[K]) => put<AllSettings[K]>(`/settings/${key}`, value),
    onSuccess: (v) => {
      qc.setQueryData<AllSettings>(['settings'], (old) => (old ? { ...old, [key]: v } : old));
      toast.success('Saved — the website updates in a few seconds.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
