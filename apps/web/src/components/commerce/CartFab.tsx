'use client';

import { usePathname } from 'next/navigation';
import { LinkLabel } from '@/components/ui/LinkLabel';
import { bus } from '@/lib/bus';
import { cartCount, useCart } from '@/lib/cart';
import { cx } from '@/lib/cx';
import { useT } from '@/lib/site';
import { ui, useUi } from '@/lib/store';

/** Floating "YOUR ORDER (n)" pill in the menu-label style; appears once something is in the cart. */
export function CartFab() {
  const t = useT();
  const count = useCart((s) => cartCount(s.items));
  const pathname = usePathname() || '';
  const onCheckout = /\/(checkout|order)(\/|$)/.test(pathname);
  const hidden = useUi((s) => s.isMenuOpen || s.isCartOpen || s.isNavigating || s.isFirstLoad) || onCheckout;
  return (
    <button
      className={cx(
        'fixed right-offset bottom-offset z-30 cursor-pointer bg-accent px-24 py-16 text-24 text-secondary uppercase',
        '[transition:transform_1s_var(--ease-expo)]',
        count > 0 && !hidden ? '[pointer-events:all] transform-[translateZ(0)]' : 'pointer-events-none transform-[translate3d(0,250%,0)]',
      )}
      onClick={() => {
        if (ui().isMenuOpen) bus.emit('CLOSE_MENU');
        ui().set({ isCartOpen: true });
      }}
      aria-haspopup="dialog"
      aria-label={`${t('cart', 'Your order')} (${count})`}
      tabIndex={count > 0 ? 0 : -1}
    >
      <LinkLabel text={`${t('cart', 'Your order')} (${count})`} />
    </button>
  );
}
