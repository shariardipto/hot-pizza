'use client';

/**
 * In-view observer: adds `is-inview` to `[data-observe]` elements (port of the original plugin).
 * `data-observe="once"` keeps the class after the first reveal; any other value toggles it.
 */
let observer: IntersectionObserver | null = null;
let timer: number | undefined;

function create() {
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        const once = el.dataset.observe === 'once';
        if (e.isIntersecting) {
          el.classList.add('is-inview');
          if (once) observer?.unobserve(el);
        } else if (!once) el.classList.remove('is-inview');
      }
    },
    { rootMargin: '0px', threshold: 0 },
  );
  document.querySelectorAll('[data-observe]').forEach((el) => observer!.observe(el));
}

/** Re-scan the page (called 100 ms after every navigation, like the original router hook). */
export function refreshObserver(delay = 100) {
  window.clearTimeout(timer);
  timer = window.setTimeout(create, delay);
}

/** Observe a single element added after the initial scan (client-side rendered content). */
export function observe(el: Element | null) {
  if (el && observer) observer.observe(el);
}
