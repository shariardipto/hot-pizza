'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cx } from '@/lib/cx';
import { useSite } from '@/lib/site';
import { TextLogo } from './TextLogo';

/*
 * Uploaded logo (theme.logo.mode = "image"): the full logo morphs into the compact mark in step with the red panel
 * (MenuLabel's Flip: collapse = 0.25s delay + 0.5s expo.inOut, expand = 0.5s expo.out). The full logo shrinks to
 * scale(0.25) from its top centre — always narrower than the shrinking panel — and fades out; the mark settles from
 * 1.5× to its size and fades in once the panel is nearly closed.
 *
 * The states follow `data-logo="mark"` on #menu-label, which MenuLabel sets in the same call that starts the panel's
 * Flip — not a React prop, which applies a render later and let the logo trail the panel on busy frames.
 * Outside the header (the intro) the logo simply stays full. cubic-bezier(0.87,0,0.13,1) = GSAP expo.inOut.
 */
const fullImg = cx(
  'mx-auto my-0 block h-auto max-w-full origin-[50%_0] object-contain opacity-100 will-change-transform transform-none',
  '[transition:transform_0.5s_var(--ease-expo),opacity_0.35s_var(--ease-expo)_0.05s]',
  '[[data-logo=mark]_&]:transform-[scale(0.25)] [[data-logo=mark]_&]:opacity-0',
  '[[data-logo=mark]_&]:[transition:transform_0.5s_cubic-bezier(0.87,0,0.13,1)_0.25s,opacity_0.25s_var(--ease-expo)_0.3s]',
);
/**
 * The compact mark fits the collapsed red pill (its width is MenuLabel's max(6rem,min(6vw,10rem))): 80% of the pill
 * width, at most 1.2× as tall, any aspect ratio. It sits at the top of the logo box, just under the menu lines;
 * `.menu-label__mark` is how MenuLabel measures it to size the pill.
 */
const markImg = cx(
  'menu-label__mark absolute top-0 right-0 left-0 mx-auto h-auto w-[calc(max(6rem,min(6vw,10rem))*0.8)] max-h-[calc(max(6rem,min(6vw,10rem))*1.2)] object-contain',
  'origin-[50%_0] opacity-0 will-change-transform transform-[scale(1.5)] [transition:transform_0.5s_var(--ease-expo),opacity_0.12s_var(--ease-expo)]',
  '[[data-logo=mark]_&]:pointer-events-auto [[data-logo=mark]_&]:opacity-100 [[data-logo=mark]_&]:transform-none',
  '[[data-logo=mark]_&]:[transition:transform_0.5s_cubic-bezier(0.87,0,0.13,1)_0.25s,opacity_0.3s_var(--ease-expo)_0.5s]',
);

/**
 * Brand logo that collapses into its mark when the header shrinks.
 * Text logo: the letters slide away and the letter mark glides to the middle (TextLogo).
 * Uploaded logo: morphs full logo ↔ compact mark in step with the panel. Without an uploaded image the text logo is shown.
 */
export const LogoMorphing = forwardRef<HTMLDivElement, { collapsed?: boolean; className?: string }>(function LogoMorphing(
  { collapsed = false, className },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { settings } = useSite();
  const logo = settings.theme.logo;
  useImperativeHandle(ref, () => root.current!);

  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  if (logo.mode === 'image' && logo.image) {
    const compact = logo.compactImage ?? logo.image;
    return (
      <div ref={root} className={className}>
        {/* The logo fills the box width; MenuLabel sizes the header panel to the logo's shape (--logo-aspect). */}
        <div className="relative w-full">
          <img
            className={fullImg}
            src={logo.image.url}
            alt={logo.image.alt || settings.site.name}
            width={logo.image.width}
            height={logo.image.height}
            draggable={false}
          />
          <img
            className={markImg}
            src={compact.url}
            alt=""
            aria-hidden="true"
            width={compact.width}
            height={compact.height}
            draggable={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className={className}>
      <TextLogo text={logo.text?.trim() || settings.site.name} mark={logo.mark ?? ''} collapsed={isCollapsed} label={settings.site.name} />
    </div>
  );
});
