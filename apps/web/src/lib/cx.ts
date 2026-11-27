import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge, taught the design tokens of src/styles/tailwind.css, so that when a parent passes a class that
 * conflicts with a component's own class (e.g. `text-35` vs `text-24`), the parent's (last) class wins.
 */
const twMerge = extendTailwindMerge({
  // A font-size class (text-35, which also sets a default line-height) must not remove an explicit leading-* class:
  // in CSS, leading-* always wins over the font-size's default line-height — keep both.
  override: { conflictingClassGroups: { 'font-size': [] } },
  extend: {
    theme: {
      text: ['340', '300', '260', '240', '110', '90', '35', '24', '20', 'base'],
      color: ['bg', 'alt', 'accent', 'secondary', 'accent-dark', 'footer-links', 'nav-links', 'menu-links'],
      font: ['base', 'regular'],
      ease: ['expo', 'in-out-expo'],
      breakpoint: ['md', 'lg', 'xl'],
      spacing: [
        'fluid-200', 'fluid-160', 'fluid-120', 'fluid-100', 'fluid-80', 'fluid-60', 'fluid-40', 'fluid-20', 'fluid-14',
        'gutter', 'gutter-half', 'gutter-double', 'offset', 'offset-double', 'width', 'col',
        'col-1', 'col-2', 'col-3', 'col-4', 'col-5', 'col-6', 'col-7', 'col-8', 'col-9', 'col-10', 'col-11', 'col-12',
      ],
    },
  },
});

/**
 * Class names: `cx('flex gap-20', isOpen && 'opacity-100', className)` — falsy values skipped, conflicts merged.
 * Rule of thumb: don't mix a named utility and an arbitrary property for the same CSS property as base + override
 * (e.g. `pointer-events-none` + `[pointer-events:all]`) — tailwind-merge can't tell they conflict; make them exclusive.
 */
export function cx(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}
