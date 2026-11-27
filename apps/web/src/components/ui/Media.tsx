'use client';

import { useEffect, useState, type HTMLAttributes } from 'react';
import type { ImageValue } from '@app/shared/content';
import { cx } from '@/lib/cx';
import { imgUrl } from '@/lib/img';
import { Picture } from './Picture';

/** Both layers sit in the same grid cell ("media"). */
const layer = 'h-full w-full object-cover [grid-area:media]';

export interface MediaProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** URL or image value from the CMS. */
  image: string | ImageValue | null | undefined;
  thumb?: boolean;
  alt?: string;
  width?: number;
  height?: number;
  pictureClassName?: string;
}

/** Image with fade-in once loaded and optional blurred thumbnail (port of the original Media). */
export function Media({ image, thumb = false, alt, width, height, className, pictureClassName, onClick, ...rest }: MediaProps) {
  const url = typeof image === 'string' ? image : image?.url;
  const w = width ?? (typeof image === 'object' ? image?.width : undefined);
  const h = height ?? (typeof image === 'object' ? image?.height : undefined);
  const altText = alt ?? (typeof image === 'object' ? image?.alt : undefined) ?? 'image';
  const [isLoaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!url) return;
    let loader: HTMLImageElement | null = new Image();
    loader.src = imgUrl(url);
    if (loader.complete) setLoaded(true);
    else
      loader.onload = () => {
        setLoaded(true);
        loader = null;
      };
    return () => {
      if (loader) loader.onload = null;
      loader = null;
    };
  }, [url]);

  return (
    <div
      {...rest}
      className={cx("relative grid overflow-hidden [grid-template-areas:'media']", className)}
      onClick={(e) => {
        setLoaded(true);
        onClick?.(e);
      }}
    >
      {url ? <Picture image={url} width={w} height={h} alt={altText} className={cx(
            layer,
            'z-10 opacity-100 will-change-[opacity] [transition:opacity_0.75s_var(--ease-expo)]',
            !isLoaded && 'opacity-0',
            pictureClassName,
          )} /> : null}
      {url && thumb ? (
        <Picture image={imgUrl(url, { w: 200, blur: 200 })} width={w} height={h} alt={`thumbnail-${altText}`} className={cx(
            layer,
            "z-5 before:absolute before:right-0 before:left-0 before:h-full before:w-full before:opacity-0 before:content-['']",
            'before:will-change-[backdrop-filter] before:[transition:all_0.75s_var(--ease-expo)_1s]',
            !isLoaded && 'before:opacity-100 before:[backdrop-filter:blur(20px)]',
          )} />
      ) : null}
    </div>
  );
}
