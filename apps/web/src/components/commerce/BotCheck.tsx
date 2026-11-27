'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useSite } from '@/lib/site';

/**
 * Cloudflare Turnstile bot check for checkout and bookings.
 * Runs invisibly in the background; a small box only appears when Cloudflare needs the visitor to click.
 * Rendered only when the admin enabled it and the keys are configured (`settings.captcha`).
 */

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loader: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export interface BotCheckHandle {
  /** A fresh single-use token — waits (up to 60 s) while the check runs; `undefined` when the check is off. */
  token(): Promise<string | undefined>;
  /** Tokens are single-use: call after every submit attempt. */
  reset(): void;
}

export function BotCheck({ action, ref }: { action: 'checkout' | 'reservation'; ref?: Ref<BotCheckHandle> }) {
  const { settings, locale } = useSite();
  const captcha = settings.captcha;
  const el = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const waiting = useRef<((t: string | undefined) => void)[]>([]);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (!captcha || !el.current) return;
    let alive = true;
    const settle = (t: string | undefined) => {
      for (const fn of waiting.current.splice(0)) fn(t);
    };
    loadTurnstile()
      .then(() => {
        if (!alive || !el.current || !window.turnstile) return;
        widget.current = window.turnstile.render(el.current, {
          sitekey: captcha.siteKey,
          action,
          language: locale,
          appearance: 'interaction-only',
          size: 'flexible',
          theme: 'light',
          'refresh-expired': 'auto',
          callback: (t: string) => {
            token.current = t;
            settle(t);
          },
          'expired-callback': () => (token.current = null),
          'error-callback': () => {
            token.current = null;
            settle(undefined);
          },
          'before-interactive-callback': () => setInteractive(true),
          'after-interactive-callback': () => setInteractive(false),
        });
      })
      .catch(() => settle(undefined)); // blocked by the network/extension → the server answers `captcha_failed`
    return () => {
      alive = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [captcha?.siteKey, action, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(
    ref,
    () => ({
      token() {
        if (!captcha) return Promise.resolve(undefined);
        if (token.current) {
          const t = token.current;
          token.current = null;
          return Promise.resolve(t);
        }
        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve(undefined), 60_000);
          waiting.current.push((t) => {
            clearTimeout(timer);
            token.current = null;
            resolve(t);
          });
        });
      },
      reset() {
        token.current = null;
        if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
      },
    }),
    [captcha],
  );

  if (!captcha) return null;
  // Out of the layout while it runs invisibly; shown only when Cloudflare needs a click.
  return <div ref={el} className={interactive ? 'max-w-[40rem]' : 'absolute h-px w-px overflow-hidden [clip-path:inset(50%)]'} />;
}
