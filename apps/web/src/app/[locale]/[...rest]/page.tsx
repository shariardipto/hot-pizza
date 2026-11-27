import { notFound } from 'next/navigation';

/** Any unknown path inside a language renders the localized 404 (keeps the animated shell). */
export default function CatchAll() {
  notFound();
}
