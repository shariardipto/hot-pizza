'use client';

import { Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark shadow-xs',
  secondary: 'bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50 shadow-xs',
  ghost: 'text-zinc-700 hover:bg-zinc-100',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' }>(
  function Button({ variant = 'primary', loading, size = 'md', className, children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
          VARIANTS[variant],
          className,
        )}
        {...rest}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {children}
      </button>
    );
  },
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('input', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn('input min-h-20', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn('input pr-8', className)} {...rest}>
      {children}
    </select>
  );
});

export function Field({ label, hint, error, children, className }: { label?: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      {label ? <label className="label">{label}</label> : null}
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; description?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-60')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-zinc-300')}
      >
        <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition', checked ? 'left-4.5' : 'left-0.5')} />
      </button>
      {label || description ? (
        <span className="text-sm">
          <span className="font-medium text-zinc-800">{label}</span>
          {description ? <span className="block text-xs text-zinc-500">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

export function Card({ title, description, actions, children, className, bodyClassName }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('card', className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            {title ? <h2 className="font-semibold text-zinc-900">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-zinc-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

const BADGE: Record<string, string> = {
  gray: 'bg-zinc-100 text-zinc-700',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
};
export function Badge({ color = 'gray', children, className }: { color?: keyof typeof BADGE; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-zinc-500/10', BADGE[color], className)}>{children}</span>;
}

export const STATUS_COLOR: Record<string, keyof typeof BADGE> = {
  pending: 'yellow',
  confirmed: 'blue',
  preparing: 'violet',
  ready: 'violet',
  shipped: 'blue',
  delivered: 'green',
  completed: 'green',
  seated: 'green',
  cancelled: 'red',
  refunded: 'gray',
  no_show: 'red',
  unpaid: 'gray',
  paid: 'green',
  failed: 'red',
  partially_refunded: 'gray',
  published: 'green',
  draft: 'gray',
};

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-zinc-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 px-6 py-14 text-center">
      <p className="font-medium text-zinc-700">{title}</p>
      {children ? <div className="mt-2 text-sm text-zinc-500">{children}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-5 animate-spin text-zinc-400', className)} />;
}

export function Loading() {
  return (
    <div className="flex h-40 items-center justify-center">
      <Spinner />
    </div>
  );
}

/** Native <dialog> modal. */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn('m-auto w-[calc(100%-2rem)] rounded-2xl p-0 shadow-2xl backdrop:bg-zinc-900/40', wide ? 'max-w-5xl' : 'max-w-lg')}
    >
      {open ? (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100" aria-label="Close">
              <X className="size-4" />
            </button>
          </header>
          <div className="overflow-y-auto p-5">{children}</div>
          {footer ? <footer className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
      {empty ? <p className="py-10 text-center text-sm text-zinc-500">Nothing here yet.</p> : null}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-600">
      <span>
        {total} result{total === 1 ? '' : 's'}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span>
          {page} / {pages}
        </span>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
