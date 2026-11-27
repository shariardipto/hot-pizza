import { BrandIcon } from '@/components/brand/Logos';
import { cx } from '@/lib/cx';
import { mdInline } from '@/lib/split';
import { MotionTextLine } from './MotionTextLine';

/** Centered uppercase paragraph with brand icon + optional title (port of Paragraph). */
export function TextBlock({
  text,
  title,
  small = false,
  xsmall = false,
  withIcon = true,
  md = false,
  className,
}: {
  text: string | null | undefined;
  title?: string | null;
  small?: boolean;
  xsmall?: boolean;
  withIcon?: boolean;
  /** Render inline markdown (line breaks → <br>), like the original `$md.renderInline`. */
  md?: boolean;
  className?: string;
}) {
  const hasTitle = Boolean(title);
  return (
    <div className={cx('flex flex-col items-center justify-center uppercase', className)}>
      {withIcon ? <BrandIcon className={hasTitle ? 'mb-fluid-14' : 'mb-fluid-40'} /> : null}
      {/* (The original also adds sp-60 without the icon, but its sp-40 always won.) */}
      {hasTitle ? <h3 className="mb-fluid-40">{title}</h3> : null}
      <MotionTextLine
        className={cx(
          'max-w-width text-center md:max-w-col-6 lg:max-w-col-8',
          xsmall && 'max-w-col-3 md:max-w-col-3 lg:max-w-col-3',
          small && 'lg:max-w-col-6',
        )}
        tag="p" {...(md ? { html: mdInline(text) } : { text: text ?? '' })} />
    </div>
  );
}
