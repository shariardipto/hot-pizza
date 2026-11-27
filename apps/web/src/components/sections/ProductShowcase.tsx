'use client';

import { gsap } from 'gsap';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BrandIcon } from '@/components/brand/Logos';
import { TLink } from '@/components/nav/TLink';
import { LinkLabel } from '@/components/ui/LinkLabel';
import { MotionTextLine } from '@/components/ui/MotionTextLine';
import { buildCatalogIndex } from '@/lib/catalog';
import { cx } from '@/lib/cx';
import { imgUrl } from '@/lib/img';
import { useSite, useT } from '@/lib/site';
import { useUi } from '@/lib/store';

/** Type / flavor buttons: an underline (::after) in the current text color grows in when active. */
const switchButton = (active: boolean) =>
  cx(
    'relative cursor-pointer uppercase',
    "after:absolute after:left-0 after:flex after:h-[2px] after:w-full after:bg-(--text-color) after:content-['']",
    'after:[transition:transform_1s_var(--ease-expo),background_2s_var(--ease-expo)_0.25s]',
    active ? 'is-active after:transform-[scaleX(1)]' : 'after:transform-[scaleX(0)]',
  );
const productMedia = 'absolute z-15 w-col-3 lg:w-col-4';

/** Interactive product switcher on the home page (menu category × flavor). */
export function ProductShowcase({ className }: { className?: string }) {
  const { products, globals } = useSite();
  const t = useT();
  const isMobile = useUi((x) => x.isMobile);
  const idx = useMemo(() => buildCatalogIndex(products), [products]);

  const firstType = idx.types[0]?.uid ?? null;
  const firstFlavor = firstType ? idx.typeMap[firstType]!.relatedFlavors[0] : null;
  const findProduct = (flavor: string | null | undefined, type: string | null | undefined) =>
    idx.products.find((p) => p.flavor.uid === flavor && p.type.uid === type) ?? idx.products.find((p) => p.type.uid === type);

  const [currentType, setCurrentType] = useState(firstType);
  const [currentFlavor, setCurrentFlavor] = useState(firstFlavor);
  const [currentProduct, setCurrentProduct] = useState(() => findProduct(firstFlavor, firstType));
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [nextImage, setNextImage] = useState<string | null>(null);
  const state = useRef({ isAnimating: false, nextProduct: currentProduct, nextImage: null as string | null });
  const currentMedia = useRef<HTMLDivElement>(null);
  const nextMedia = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentImage(currentProduct?.image ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!idx.types.length) return null;

  const relatedFlavors = (currentType && idx.typeMap[currentType]?.relatedFlavors) || [];
  const half = Math.ceil(idx.types.length / 2);
  const splitTypes = [idx.types.slice(0, half), idx.types.slice(half)];
  const flavorData = currentFlavor ? idx.flavorMap[currentFlavor]?.data : null;

  const preview = (flavor = currentFlavor, type = currentType) => {
    if (state.current.isAnimating) return;
    const p = findProduct(flavor, type);
    state.current.nextProduct = p;
    if (p?.image) new Image().src = imgUrl(p.image);
    state.current.nextImage = p?.image ?? null;
    setNextImage(p?.image ?? null);
  };

  const offset = (el: HTMLElement | null) => window.innerWidth + (el?.clientWidth ?? 0) / 2;

  const translateMedias = () => {
    const r = state.current;
    r.isAnimating = true;
    gsap.set(nextMedia.current, { opacity: 1, rotate: '20deg', scale: 0.8 });
    gsap.to(currentMedia.current, {
      x: -1 * offset(currentMedia.current),
      duration: 1,
      rotate: '-20deg',
      scale: 0.4,
      ease: 'quart.inOut',
      force3D: true,
      onComplete: () => {
        setCurrentImage(r.nextImage);
        gsap.set(nextMedia.current, {
          x: offset(currentMedia.current),
          opacity: 0,
          rotate: 0,
          scale: 0.4,
          delay: 0.25,
          onComplete: () => {
            r.isAnimating = false;
          },
        });
        gsap.set(currentMedia.current, { x: '0%', rotate: 0, scale: 1, delay: 0.25 });
      },
    });
    gsap.to(nextMedia.current, { x: '0', duration: 0.85, ease: 'quart.inOut', rotate: 0, scale: 1, force3D: true });
  };

  const setType = (type: string) => {
    if (state.current.isAnimating || currentType === type) return;
    setCurrentType(type);
    const rel = idx.typeMap[type]?.relatedFlavors ?? [];
    const flavor = rel.includes(currentFlavor!) ? currentFlavor : rel[0]!;
    setCurrentFlavor(flavor);
    preview(undefined, type);
    setCurrentProduct(state.current.nextProduct);
    translateMedias();
  };

  const setFlavor = (flavor: string) => {
    if (state.current.isAnimating || currentFlavor === flavor) return;
    setCurrentFlavor(flavor);
    preview(flavor);
    setCurrentProduct(state.current.nextProduct);
    translateMedias();
  };

  const typeButton = (type: (typeof idx.types)[number]) => (
    <button key={type.uid} className={switchButton(type.uid === currentProduct?.type.uid)} onClick={() => setType(type.uid)} onMouseEnter={() => preview(undefined, type.uid)}>
      <LinkLabel text={type.data.name} underline={false} />
    </button>
  );

  return (
    <div
      className={cx(
        'z-5 grid h-[70vh] w-screen max-w-[100vw] grid-rows-[auto_auto_auto] items-center justify-center gap-gutter overflow-hidden',
        'text-(color:--text-color) [clip-path:inset(0)] [transition:background_2s_var(--ease-expo)_0.25s,color_2s_var(--ease-expo)_0.25s]',
        'md:sticky md:top-0 md:h-screen md:grid-rows-[auto_50vh_auto] md:gap-gutter-double',
        className,
      )}
      style={{ background: flavorData?.pageColor ?? undefined, '--text-color': flavorData?.optimizeLegibility ? 'var(--c-secondary)' : undefined } as CSSProperties}
    >
      <div className="flex justify-center [align-self:end]">
        <div className="flex w-col-4 justify-end gap-gutter-double text-right max-md:hidden">{splitTypes[0]!.map(typeButton)}</div>
        <span style={isMobile ? undefined : { display: 'none' }}>{t('showcaseLine1', 'HOT FROM')}</span>
        <BrandIcon className="mx-fluid-80 my-0" />
        <span style={isMobile ? undefined : { display: 'none' }}>{t('showcaseLine2', 'THE OVEN')}</span>
        <div className="flex w-col-4 gap-gutter-double max-md:hidden">{splitTypes[1]!.map(typeButton)}</div>
      </div>
      <div className="relative flex items-center justify-center text-center text-340 uppercase max-md:mb-gutter-double max-md:pb-col-1">
        <TLink className="absolute z-15 flex h-full w-col-3 items-center justify-center max-md:bottom-[-30%] md:w-col-4" href={`/products/${currentProduct?.uid ?? ''}`} data-cursor-text={globals.discover ?? 'Discover'}>
          <div ref={currentMedia} className={cx(productMedia, 'group/current flex')}>
            {currentImage ? <img className="flex [transition:transform_1.25s_var(--ease-expo)] group-hover/current:transform-[scale(1.05)_rotate(-4deg)]" src={imgUrl(currentImage)} alt={currentProduct?.data.metaTitle ?? 'Product'} /> : null}
          </div>
          <div ref={nextMedia} className={cx(productMedia, 'opacity-0 transform-[translateX(100vw)]')}>
            {nextImage ? <img src={imgUrl(nextImage)} alt="" aria-hidden="true" /> : null}
          </div>
        </TLink>
        <div className="pointer-events-none select-none">
          <MotionTextLine text={globals.productWordTop} lineHeight="85%" delay={1} />
          <MotionTextLine text={globals.productWordBottom} lineHeight="85%" delay={2} />
        </div>
      </div>
      <div className="flex justify-center gap-gutter-double [align-self:start]">
        {relatedFlavors.map((f) => (
          <button key={f} className={switchButton(f === currentProduct?.flavor.uid)} onClick={() => setFlavor(f)} onMouseEnter={() => preview(f)}>
            <LinkLabel text={idx.flavorMap[f]?.data.name} underline={false} />
          </button>
        ))}
      </div>
    </div>
  );
}
