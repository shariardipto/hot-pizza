import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';
import { imgUrl } from '@/lib/img';

export interface PictureProps {
  image: string | null | undefined;
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
}

/** <picture> with a 1000px source for small screens (port of the original Picture). */
export function Picture({ image, width, height, alt = 'Image', className }: PictureProps) {
  const full = imgUrl(image);
  const small = imgUrl(image, { width: 1000 });
  const style: CSSProperties | undefined = width && height ? { aspectRatio: `${width}/${height}` } : undefined;
  return (
    <div className={cx('relative flex h-full w-full overflow-hidden', className)} style={style}>
      <picture className="w-full">
        <source media="(max-width: 599px)" srcSet={small} />
        <source media="(min-width: 600px)" srcSet={full} />
        <img className="min-h-full min-w-full object-cover" srcSet={`${small} 100w, ${full} 800w`} src={full} draggable={false} alt={alt} width={width} height={height} />
      </picture>
    </div>
  );
}
