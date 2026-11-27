'use client';

import type { ImageValue } from '@app/shared/content';
import { BrandSealSmall } from '@/components/brand/Logos';
import { Media } from '@/components/ui/Media';
import { MotionTextChar } from '@/components/ui/MotionTextChar';
import { mdInline } from '@/lib/split';

/** Full-screen sticky image with seal + titles; the next section slides over it (`group/sticky` gets .is-inview). */
export function HomeSticky({ image, titleUp, titleDown }: { image: ImageValue | null; titleUp: string | null; titleDown: string | null }) {
  return (
    <section className="md:sticky md:top-0">
      <div className="group/sticky top-0 z-1 flex h-[80vh] flex-col items-center justify-center overflow-hidden md:sticky md:h-screen" data-observe="">
        <div className="absolute z-11 flex flex-col items-center justify-center gap-fluid-60">
          <MotionTextChar className="text-alt text-center text-110" html={mdInline(titleUp)} />
          <BrandSealSmall className="w-col-1" fill="var(--c-text-alt)" />
          <MotionTextChar className="text-alt text-center text-110" html={mdInline(titleDown)} />
        </div>
        <Media
          className="h-full w-full transform-[scale(1.3)] group-inview/sticky:transform-[scale(1)] group-inview/sticky:[transition:transform_3s_var(--ease-expo)]"
          image={image}
          thumb={false}
          width={1920}
        />
      </div>
    </section>
  );
}
