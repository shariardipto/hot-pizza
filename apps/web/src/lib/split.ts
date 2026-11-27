'use client';

/**
 * Deterministic text splitter reproducing the DOM produced by GSAP SplitText 3.11 as used by the
 * original site (so the CSS reveal transitions behave identically):
 *
 *   chars:  <div class="word"><div class="char-mask"><div class="char" style="--index:N; --delay:D; …">x</div></div>…</div>
 *   lines:  <div class="line-mask"><div class="line" style="--index:N; --delay:D; …">…</div></div>
 *
 * `<br>` and inline elements (em, strong, a) are preserved.
 */

const BLOCK = 'position:relative;display:inline-block;';

function wrapChars(text: string, ctx: { index: number; delay: number }, frag: DocumentFragment) {
  const parts = text.replace(/\s+/g, ' ').split(/( )/);
  for (const part of parts) {
    if (part === '') continue;
    if (part === ' ') {
      frag.appendChild(document.createTextNode(' '));
      continue;
    }
    const word = document.createElement('div');
    word.className = 'word';
    word.setAttribute('style', BLOCK);
    for (const ch of Array.from(part)) {
      const mask = document.createElement('div');
      mask.className = 'char-mask';
      mask.setAttribute('style', BLOCK);
      mask.setAttribute('aria-hidden', 'true');
      const c = document.createElement('div');
      c.className = 'char';
      c.setAttribute('style', `--index:${ctx.index++}; --delay:${0.1 * ctx.delay}; position: relative; display: inline-block`);
      c.setAttribute('aria-hidden', 'true');
      c.textContent = ch;
      mask.appendChild(c);
      word.appendChild(mask);
    }
    frag.appendChild(word);
  }
}

function splitNodeChars(node: Node, ctx: { index: number; delay: number }) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      wrapChars(child.textContent ?? '', ctx, frag);
      node.replaceChild(frag, child);
    } else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName !== 'BR') {
      splitNodeChars(child, ctx);
    }
  }
}

export function splitChars(el: HTMLElement, html: string, delay: number) {
  el.innerHTML = html.trim();
  splitNodeChars(el, { index: 0, delay });
}

/** Lines: measure word positions, group by offsetTop, then wrap each line. */
export function splitLines(el: HTMLElement, html: string, delay: number | null) {
  el.innerHTML = html.trim();

  // 1) wrap every word (keeping inline parents) in a measuring span
  const words: HTMLElement[] = [];
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of (child.textContent ?? '').replace(/\s+/g, ' ').split(/( )/)) {
          if (!part) continue;
          if (part === ' ') frag.appendChild(document.createTextNode(' '));
          else {
            const s = document.createElement('span');
            s.dataset.w = '';
            s.textContent = part;
            words.push(s);
            frag.appendChild(s);
          }
        }
        node.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName !== 'BR') walk(child);
    }
  };
  walk(el);

  // 2) group top-level runs by line using the words' offsetTop
  const lines: Node[][] = [];
  let current: Node[] = [];
  let lastTop: number | null = null;
  const topOf = (n: Node): number | null => {
    if (n.nodeType !== Node.ELEMENT_NODE) return null;
    const e = n as HTMLElement;
    if (e.tagName === 'BR') return null;
    const w = e.matches('[data-w]') ? e : e.querySelector<HTMLElement>('[data-w]');
    return w ? w.offsetTop : null;
  };
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName === 'BR') {
      lines.push(current);
      current = [];
      lastTop = null;
      continue;
    }
    const top = topOf(child);
    if (top !== null && lastTop !== null && Math.abs(top - lastTop) > 2) {
      lines.push(current);
      current = [];
    }
    if (top !== null) lastTop = top;
    current.push(child);
  }
  if (current.length) lines.push(current);

  // 3) rebuild
  const textAlign = getComputedStyle(el).textAlign;
  el.innerHTML = '';
  lines
    .filter((l) => l.some((n) => (n.textContent ?? '').trim()))
    .forEach((nodes, i) => {
      const mask = document.createElement('div');
      mask.className = 'line-mask';
      mask.setAttribute('style', `position:relative;display:block;text-align:${textAlign};`);
      mask.setAttribute('aria-hidden', 'true');
      const line = document.createElement('div');
      line.className = 'line';
      line.setAttribute('style', delay === null ? `--index:${i}; position: relative; display: inline-block` : `--index:${i}; --delay:${0.1 * delay}; position: relative; display: inline-block`);
      line.setAttribute('aria-hidden', 'true');
      // trim edge spaces
      while (nodes.length && nodes[0]!.nodeType === Node.TEXT_NODE && !(nodes[0]!.textContent ?? '').trim()) nodes.shift();
      while (nodes.length && nodes[nodes.length - 1]!.nodeType === Node.TEXT_NODE && !(nodes[nodes.length - 1]!.textContent ?? '').trim()) nodes.pop();
      nodes.forEach((n) => line.appendChild(n));
      mask.appendChild(line);
      el.appendChild(mask);
    });
  // unwrap measuring spans
  el.querySelectorAll('[data-w]').forEach((s) => s.replaceWith(document.createTextNode(s.textContent ?? '')));
}

/** Minimal inline markdown (the original used markdown-it renderInline with `breaks: true`). */
export function mdInline(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>\n');
}

/** Escape plain text for innerHTML. */
export function escapeHtml(text: string | null | undefined): string {
  return (text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
