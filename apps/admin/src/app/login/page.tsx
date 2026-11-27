'use client';

import { Pizza, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/ui';
import { authClient } from '@/lib/auth-client';

type Mode = 'login' | 'forgot' | 'totp' | 'backup';

const TITLES: Record<Mode, string> = {
  login: 'Sign in',
  forgot: 'Reset password',
  totp: 'Two-factor authentication',
  backup: 'Use a backup code',
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('login');

  const done = () => router.replace(params.get('next') || '/');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'forgot') {
        const { error } = await authClient.requestPasswordReset({ email, redirectTo: `${location.origin}/reset-password` });
        if (error) setError(error.message ?? 'Could not send the e-mail');
        else toast.success('If the account exists, a reset link is on its way.');
        return;
      }
      if (mode === 'totp' || mode === 'backup') {
        const clean = mode === 'totp' ? code.replace(/\D/g, '') : code.trim();
        const { error } =
          mode === 'totp'
            ? await authClient.twoFactor.verifyTotp({ code: clean, trustDevice })
            : await authClient.twoFactor.verifyBackupCode({ code: clean, trustDevice });
        if (error) {
          setCode('');
          // The challenge cookie lives 10 minutes; after that the password step starts over.
          if (error.status === 401) {
            setMode('login');
            setError('The sign-in took too long. Please enter your password again.');
          } else setError(error.status === 429 ? 'Too many attempts — wait a few seconds.' : 'That code is not valid.');
          return;
        }
        return done();
      }
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(error.status === 403 ? 'This account is disabled.' : error.status === 429 ? 'Too many attempts — try again in a minute.' : 'Wrong e-mail or password.');
        return;
      }
      if (data && 'twoFactorRedirect' in data && data.twoFactorRedirect) {
        setPassword('');
        setMode('totp');
        return;
      }
      done();
    } finally {
      setLoading(false);
    }
  }

  const twoFactor = mode === 'totp' || mode === 'backup';

  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand font-bold text-gold">{twoFactor ? <ShieldCheck className="size-5" /> : <Pizza className="size-5" aria-hidden="true" />}</span>
        <div>
          <h1 className="font-semibold">{TITLES[mode]}</h1>
          <p className="text-xs text-zinc-500">{twoFactor ? email : 'Site administration'}</p>
        </div>
      </div>

      {twoFactor ? (
        <>
          <p className="text-sm text-zinc-600">
            {mode === 'totp' ? 'Enter the 6-digit code from your authenticator app.' : 'Enter one of the backup codes you saved when you set up two-factor. Each code works once.'}
          </p>
          <Field label={mode === 'totp' ? 'Authentication code' : 'Backup code'}>
            <Input
              key={mode}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode={mode === 'totp' ? 'numeric' : 'text'}
              pattern={mode === 'totp' ? '[0-9 ]{6,7}' : undefined}
              maxLength={mode === 'totp' ? 7 : 32}
              placeholder={mode === 'totp' ? '123 456' : 'xxxxx-xxxxx'}
              className="text-center font-mono text-lg tracking-[0.3em]"
              required
              autoFocus
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)} />
            Trust this device for 30 days
          </label>
        </>
      ) : (
        <>
          <Field label="E-mail">
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </Field>
          {mode === 'login' ? (
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
          ) : null}
        </>
      )}

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <Button type="submit" className="w-full" loading={loading}>
        {mode === 'login' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Verify'}
      </Button>

      {twoFactor ? (
        <div className="flex justify-between text-xs text-zinc-500">
          <button type="button" className="hover:text-zinc-800" onClick={() => (setCode(''), setError(null), setMode(mode === 'totp' ? 'backup' : 'totp'))}>
            {mode === 'totp' ? 'Lost your phone? Use a backup code' : 'Use the authenticator app'}
          </button>
          <button type="button" className="hover:text-zinc-800" onClick={() => (setCode(''), setError(null), setMode('login'))}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="w-full text-center text-xs text-zinc-500 hover:text-zinc-800" onClick={() => (setError(null), setMode(mode === 'login' ? 'forgot' : 'login'))}>
          {mode === 'login' ? 'Forgot your password?' : 'Back to sign in'}
        </button>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_top,#fbf5e7,#f4f4f5)] p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
