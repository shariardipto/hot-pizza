'use client';

import { TLink } from '@/components/nav/TLink';
import { LinkLabel } from '@/components/ui/LinkLabel';
import { useT } from '@/lib/site';

/** Port of the original error page ("PAGE / NOT FOUND"). */
export function NotFoundView() {
  const t = useT();
  const lines = t('notFoundTitle', 'PAGE\nNOT FOUND').split('\n');
  return (
    <main>
      <div className="flex h-(--height) w-screen items-center justify-center" style={{ flexDirection: 'column', gap: '4rem' }}>
        <h1 className="text-260 text-center">
          {lines.map((l, i) => (
            <span key={i}>
              {l}
              {i < lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </h1>
        <TLink href="/" className="text-24 uppercase text-secondary">
          <LinkLabel text={t('notFoundCta', 'Back home')} />
        </TLink>
      </div>
    </main>
  );
}
