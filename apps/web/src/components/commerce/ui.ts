import { cx } from '@/lib/cx';

/**
 * Shared Tailwind class sets for the ordering & reservation screens (cart, checkout, order tracking, reservations).
 * Built only from the original design tokens (colors, fonts, type scale, easing, the chevron clip-path of the home
 * banners), so these screens follow Admin → Appearance like the rest of the site.
 */

// Notes: class names must appear literally in this file (Tailwind generates CSS only for classes it can read here);
// never combine a named utility and an arbitrary property for the same CSS property as base + override
// (e.g. pointer-events-none + [pointer-events:all]) — tailwind-merge can't tell they conflict. Make them exclusive.

/** Chevron-shaped call to action. Colors follow the page: --cta-bg / --cta-color, else the product colors, else the theme. */
export const ctaChevron = cx(
  'inline-flex min-w-[max(22rem,min(22vw,36rem))] cursor-pointer items-center justify-center text-center',
  'px-[calc(var(--gutter)*2)] py-[calc(var(--gutter)/1.5)] [clip-path:polygon(100%_1%,92%_50%,100%_100%,0_100%,8%_50%,0_0)]',
  'bg-(--cta-bg,var(--text-color,var(--c-accent))) text-(color:--cta-color,var(--product-color,var(--c-secondary)))',
  '[transition:transform_1s_var(--ease-expo),opacity_0.5s_var(--ease-expo)] hover:transform-[scaleX(0.95)]',
  'focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-4',
  'disabled:cursor-not-allowed disabled:opacity-45 disabled:transform-none',
  'aria-disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:transform-none',
  // "Added to cart" confirmation (wins over hover, as in the original)
  '[&.is-done,&.is-done:hover]:transform-[scaleX(1.05)]',
);

/** Quantity stepper: − value + */
export const qty = 'inline-flex items-center gap-12';
export const qtyButton = cx(
  'inline-flex h-[1.4em] w-[1.4em] cursor-pointer items-center justify-center rounded-[50%] border-2 border-current leading-[1]',
  '[transition:transform_0.5s_var(--ease-expo)] hover:transform-[scale(1.1)]',
  'focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-4',
  'disabled:cursor-default disabled:opacity-35 disabled:transform-none',
);
export const qtyValue = 'min-w-[1.4em] text-center';

/** Cart line (image · name/quantity · price), used in the drawer, checkout and order pages. */
export const lineItem = (unavailable = false) =>
  cx(
    'grid grid-cols-[8rem_1fr_auto] items-center gap-gutter border-b border-b-[color-mix(in_srgb,currentColor_35%,transparent)] px-0 py-16',
    unavailable && 'opacity-50',
  );
export const lineItemMedia =
  'aspect-square w-80 overflow-hidden rounded-[1.2rem] bg-[color-mix(in_srgb,var(--c-bg)_12%,transparent)] [&_img]:h-full [&_img]:w-full [&_img]:object-contain';
export const lineItemPrice = 'text-right whitespace-nowrap';

/** Subtotal / delivery / tax / total rows. */
export const totals = 'grid gap-8';
export const totalsRow = (total = false) => cx('flex justify-between', total && 'mt-8 border-t border-t-current pt-12');

/** Dashed info box. */
export const notice = 'rounded-[1.2rem] border border-dashed border-current px-16 py-12';

/** Page shell + grid for the form pages (checkout, reservations, order lookup / tracking). */
export const formPage = 'min-h-(--height) max-w-[100vw] bg-bg pt-[max(18rem,min(18vw,26rem))] text-accent';
export const formGrid = (split = false) =>
  cx(
    'mx-auto my-0 grid w-width gap-gutter-double',
    split && 'lg:grid-cols-[var(--col-7)_var(--col-5)] lg:[align-items:start] lg:gap-x-gutter lg:[&>aside]:sticky lg:[&>aside]:top-[max(18rem,min(18vw,26rem))]',
  );
export const panelCard = 'rounded-(--radius) bg-accent p-[calc(var(--gutter)*1.5)] text-secondary';

export const fieldset = 'mx-0 mt-0 mb-gutter-double grid min-w-0 gap-gutter p-0 [border:0] [&>legend]:mb-gutter';
/** Two (or --cols) columns from 960px. */
export const fieldsRow = 'grid gap-gutter md:grid-cols-[repeat(var(--cols,2),minmax(0,1fr))]';

/** Label + control + error. `has-error` is also the hook CheckoutView scrolls to. */
export const field = (hasError = false) => cx('grid gap-6', hasError && 'has-error');
export const fieldLabel = 'uppercase';
const control = cx(
  'w-full appearance-none rounded-none bg-transparent px-0 py-8 font-regular text-[length:max(1.8rem,min(1.8vw,2.4rem))] text-inherit',
  // Bottom line only (top/sides: no border)
  '[border-style:none_none_solid] [border-width:0_0_2px] border-current',
  'focus:border-b-secondary focus:outline-none',
  '[.has-error_&,.has-error_&:focus]:border-b-accent-dark',
);
export const fieldInput = cx(control, 'placeholder:text-inherit placeholder:opacity-45');
export const fieldTextarea = cx(control, 'min-h-90 resize-y placeholder:text-inherit placeholder:opacity-45');
/** Select with a CSS chevron drawn by two gradients. */
export const fieldSelect = cx(
  control,
  'cursor-pointer bg-no-repeat pr-30 [&_option]:text-[#222]',
  'bg-[linear-gradient(45deg,transparent_50%,currentColor_50%),linear-gradient(135deg,currentColor_50%,transparent_50%)]',
  'bg-[position:calc(100%_-_1.4rem)_55%,calc(100%_-_0.8rem)_55%] bg-[size:0.6rem_0.6rem]',
);
export const fieldError = 'font-regular text-accent-dark';
/** Calling code + number. */
export const phoneInput = 'grid grid-cols-[minmax(9rem,max-content)_1fr] gap-10 [align-items:end]';

/** Big radio cards (delivery / pick-up, payment method). */
export const choices = 'grid gap-gutter md:grid-cols-[repeat(var(--cols,2),minmax(0,1fr))]';
export const choice = (selected: boolean) =>
  cx(
    'relative grid cursor-pointer gap-6 rounded-(--radius) border-2 border-current px-20 py-16 [&_input]:absolute [&_input]:opacity-0',
    '[transition:background_0.6s_var(--ease-expo),color_0.6s_var(--ease-expo)]',
    'focus-within:outline-2 focus-within:outline-current focus-within:outline-offset-4',
    selected && 'is-selected bg-accent text-secondary',
  );
export const choiceHint = 'font-regular normal-case opacity-80';

/** Checkbox row (terms). */
export const check = 'flex cursor-pointer items-start gap-12 font-regular [&_input]:mt-2 [&_input]:h-20 [&_input]:w-20 [&_input]:accent-accent';

/** Reservation time slots. */
export const slots = 'flex flex-wrap gap-10';
export const slot = (selected: boolean) =>
  cx(
    'cursor-pointer rounded-[10rem] border-2 border-current px-16 py-8 [transition:background_0.4s_var(--ease-expo),color_0.4s_var(--ease-expo)]',
    'disabled:cursor-not-allowed disabled:opacity-30 disabled:[text-decoration:line-through]',
    selected && 'is-selected bg-accent text-secondary',
  );

/** Order progress list: filled dot = done. */
export const statusSteps = 'grid list-none gap-12';
export const statusStep = (done: boolean) =>
  cx(
    "flex items-center gap-12 opacity-40 before:h-14 before:w-14 before:rounded-[50%] before:border-2 before:border-current before:content-['']",
    done && 'is-done opacity-100 before:bg-current',
  );

export const formError = 'rounded-[1.2rem] bg-accent-dark px-16 py-12 text-bg';
export const stripeBox = 'rounded-[1.2rem] bg-bg p-16 text-[#222]';
