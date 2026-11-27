'use client';

import type { ImageValue } from '@app/shared/content';
import { Media } from '@/components/ui/Media';
import { MotionTextLine } from '@/components/ui/MotionTextLine';
import { mdInline } from '@/lib/split';

export function HomeAward({ title, image, description }: { title: string | null; image: ImageValue | null; description: string | null }) {
  if (!title && !image && !description) return null;
  return (
    <section className="relative z-10 flex flex-col items-center justify-center bg-bg p-offset-double lg:min-h-lvh" data-observe="">
      <MotionTextLine className="text-accent text-center uppercase text-90 mb-fluid-100 lg:w-col-8 max-md:w-col-4 md:max-lg:w-col-6" html={mdInline(title)} lineHeight="90%" />
      <Media className="w-col-4 mb-fluid-100" image={image} thumb={false} width={1920} />
      <MotionTextLine className="text-accent text-center uppercase text-35 lg:w-col-8 max-md:w-col-4 md:max-lg:w-col-6" html={mdInline(description)} />
    </section>
  );
}
