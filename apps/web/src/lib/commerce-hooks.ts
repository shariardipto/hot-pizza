'use client';

import { useEffect, useRef, useState } from 'react';
import type { Fulfillment, PaymentMethod } from '@app/shared/commerce';
import type { MarketResolution, Quote } from '@app/shared/api';
import { useCart, type CartItem } from './cart';
import { clientApi } from './client-api';
import { useSite } from './site';

/** Visitor's delivery country: explicit choice → detected country → default market's first country. */
export function useCountry(): [string, (c: string) => void] {
  const { country: detected } = useSite();
  const chosen = useCart((s) => s.country);
  const setCountry = useCart((s) => s.setCountry);
  const [fallback, setFallback] = useState('');
  const country = chosen || detected || fallback;

  useEffect(() => {
    if (chosen || detected) return;
    clientApi
      .market()
      .then((r) => setFallback(r.country))
      .catch(() => undefined);
  }, [chosen, detected]);

  const set = (c: string) => {
    setCountry(c);
    // Server-rendered prices follow the cookie on the next navigation.
    document.cookie = `country=${c}; path=/; max-age=31536000; samesite=lax`;
  };
  return [country, set];
}

export function useMarket(country: string) {
  const [data, setData] = useState<MarketResolution | null>(null);
  useEffect(() => {
    if (!country) return;
    let alive = true;
    clientApi
      .market(country)
      .then((r) => alive && setData(r))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [country]);
  return data;
}

/** Server-calculated prices/totals for the cart (debounced). */
export function useQuote(items: CartItem[], country: string, fulfillment: Fulfillment = 'delivery', paymentMethod?: PaymentMethod | null) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const key = JSON.stringify([items, country, fulfillment, paymentMethod]);

  useEffect(() => {
    if (!country || !items.length) {
      setQuote(null);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = window.setTimeout(() => {
      clientApi
        .quote({ country, items, fulfillment, paymentMethod: paymentMethod ?? undefined })
        .then((q) => {
          if (id !== seq.current) return;
          setQuote(q);
          setError(null);
        })
        .catch((e: Error) => id === seq.current && setError(e.message))
        .finally(() => id === seq.current && setLoading(false));
    }, 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quote, loading, error };
}
