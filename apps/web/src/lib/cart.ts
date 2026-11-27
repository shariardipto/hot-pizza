'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  /** Delivery country chosen by the visitor (ISO 3166-1 alpha-2). */
  country: string | null;
  add: (productId: string, qty?: number, max?: number) => void;
  setQty: (productId: string, qty: number, max?: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  setCountry: (c: string) => void;
}

/** Guest cart, persisted in localStorage (no account needed). */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      country: null,
      add: (productId, qty = 1, max = 99) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === productId);
          if (existing) return { items: s.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(i.quantity + qty, max) } : i)) };
          return { items: [...s.items, { productId, quantity: Math.min(qty, max) }] };
        }),
      setQty: (productId, qty, max = 99) =>
        set((s) => ({
          items: qty <= 0 ? s.items.filter((i) => i.productId !== productId) : s.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.min(qty, max) } : i)),
        })),
      remove: (productId) => set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
      setCountry: (country) => set({ country }),
    }),
    { name: 'cart-v1', storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0);
