'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, Field, Input } from '@/components/ui';
import { authClient } from '@/lib/auth-client';

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) toast.error(error.message ?? 'The link is invalid or expired');
    else {
      toast.success('Password updated — please sign in.');
      router.replace('/login');
    }
  }
  return (
    <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
      <h1 className="font-semibold">Choose a new password</h1>
      <Field label="New password" hint="At least 10 characters.">
        <Input type="password" minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      <Button type="submit" className="w-full" loading={loading} disabled={!token}>
        Save password
      </Button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Suspense>
        <ResetForm />
      </Suspense>
    </main>
  );
}
