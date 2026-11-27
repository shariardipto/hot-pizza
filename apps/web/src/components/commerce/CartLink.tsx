'use client';

import { LinkLabel } from '@/components/ui/LinkLabel';
import { cartCount, useCart } from '@/lib/cart';
import { cx } from '@/lib/cx';
import { useT } from '@/lib/site';
import { ui } from '@/lib/store';
import { bus } from '@/lib/bus';

/** "Your order (2)" — styled exactly like the nav links; opens the cart drawer. */
export function CartLink({ className }: { className?: string }) {
  const t = useT();
  const count = useCart((s) => cartCount(s.items));
  return (
    <button
      className={cx('cursor-pointer uppercase', className)}
      onClick={() => {
        if (ui().isMenuOpen) bus.emit('CLOSE_MENU');
        ui().set({ isCartOpen: true });
      }}
      aria-haspopup="dialog"
      aria-label={`${t('cart', 'Your order')} (${count})`}
    >
      <LinkLabel text={`${t('cart', 'Your order')}${count ? ` (${count})` : ''}`} />
    </button>
  );
}
