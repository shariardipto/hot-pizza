'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, KeyRound, LogOut, Monitor, ShieldAlert, ShieldCheck, Smartphone } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, Field, Input, Loading, Modal, PageHeader, Switch } from '@/components/ui';
import { authClient } from '@/lib/auth-client';
import { useMe } from '@/lib/me';
import { relative } from '@/lib/utils';

const errText = (e: { message?: string; status?: number } | null | undefined, fallback: string) =>
  e?.status === 400 && /password/i.test(e.message ?? '') ? 'Wrong password.' : e?.status === 429 ? 'Too many attempts — wait a few seconds.' : e?.message || fallback;

function downloadCodes(codes: string[], site: string) {
  const text = `${site} admin — two-factor backup codes\nGenerated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}\nEach code can be used once.\n\n${codes.join('\n')}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'admin-backup-codes.txt' });
  a.click();
  URL.revokeObjectURL(url);
}

function BackupCodes({ codes, site }: { codes: string[]; site: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">Save these somewhere safe (password manager or printed). Each code signs you in once if you lose your phone.</p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 font-mono text-sm">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(codes.join('\n')).then(() => toast.success('Copied'))}>
          <Copy className="size-4" /> Copy
        </Button>
        <Button size="sm" variant="secondary" onClick={() => downloadCodes(codes, site)}>
          <Download className="size-4" /> Download .txt
        </Button>
      </div>
    </div>
  );
}

/** Set-up wizard: password → scan QR → confirm first code → save backup codes. */
function EnableTwoFactor({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { me } = useMe();
  const [step, setStep] = useState<'password' | 'scan' | 'codes'>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const secret = setup ? (new URL(setup.totpURI).searchParams.get('secret') ?? '') : '';

  useEffect(() => {
    if (!open) return;
    setStep('password');
    setPassword('');
    setCode('');
    setSetup(null);
    setError(null);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === 'password') {
        const { data, error } = await authClient.twoFactor.enable({ password, issuer: `${me.siteName} Admin` });
        if (error || !data || !('totpURI' in data)) return setError(errText(error, 'Could not start the set-up'));
        setSetup({ totpURI: data.totpURI!, backupCodes: data.backupCodes ?? [] });
        setStep('scan');
      } else if (step === 'scan') {
        const { error } = await authClient.twoFactor.verifyTotp({ code: code.replace(/\D/g, '') });
        if (error) return setError(errText(error, 'That code is not valid — check the time on your phone and try again.'));
        setStep('codes');
      }
    } finally {
      setBusy(false);
    }
  }

  const finish = () => {
    onDone();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={step === 'codes' ? finish : onClose}
      title="Set up two-factor authentication"
      footer={
        step === 'codes' ? (
          <Button onClick={finish}>I saved my backup codes</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="tfa-form" loading={busy}>
              {step === 'password' ? 'Continue' : 'Verify & turn on'}
            </Button>
          </>
        )
      }
    >
      {step === 'codes' && setup ? (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
            <ShieldCheck className="size-4" /> Two-factor is on.
          </p>
          <BackupCodes codes={setup.backupCodes} site={me.siteName} />
        </div>
      ) : (
        <form id="tfa-form" onSubmit={submit} className="space-y-4">
          {step === 'password' ? (
            <>
              <p className="text-sm text-zinc-600">
                You will need an authenticator app such as Google Authenticator, Microsoft Authenticator, 1Password or Authy. Confirm your password to start.
              </p>
              <Field label="Current password">
                <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
              </Field>
            </>
          ) : setup ? (
            <>
              <p className="text-sm text-zinc-600">1. Scan this code with your authenticator app.</p>
              <div className="flex justify-center rounded-lg border border-zinc-200 bg-white p-4">
                <QRCodeSVG value={setup.totpURI} size={180} marginSize={0} title="Authenticator QR code" />
              </div>
              <details className="text-xs text-zinc-500">
                <summary className="cursor-pointer">Can’t scan? Enter the key manually</summary>
                <code className="mt-2 block break-all rounded bg-zinc-50 p-2 font-mono text-sm text-zinc-800">{secret.replace(/(.{4})/g, '$1 ').trim()}</code>
              </details>
              <Field label="2. Enter the 6-digit code the app shows">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="123 456"
                  className="text-center font-mono text-lg tracking-[0.3em]"
                  required
                  autoFocus
                />
              </Field>
            </>
          ) : null}
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </form>
      )}
    </Modal>
  );
}

/** Password-confirmed action: turn off 2FA or create new backup codes. */
function ConfirmPassword({ action, onClose, onDone }: { action: 'disable' | 'codes' | null; onClose: () => void; onDone: () => void }) {
  const { me } = useMe();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  useEffect(() => {
    setPassword('');
    setError(null);
    setCodes(null);
  }, [action]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (action === 'disable') {
        const { error } = await authClient.twoFactor.disable({ password });
        if (error) return setError(errText(error, 'Could not turn off two-factor'));
        toast.success('Two-factor turned off');
        onDone();
        onClose();
      } else {
        const { data, error } = await authClient.twoFactor.generateBackupCodes({ password });
        if (error || !data) return setError(errText(error, 'Could not create new codes'));
        setCodes(data.backupCodes);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={action !== null}
      onClose={onClose}
      title={action === 'disable' ? 'Turn off two-factor' : 'New backup codes'}
      footer={
        codes ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="pw-form" variant={action === 'disable' ? 'danger' : 'primary'} loading={busy}>
              {action === 'disable' ? 'Turn off' : 'Create new codes'}
            </Button>
          </>
        )
      }
    >
      {codes ? (
        <BackupCodes codes={codes} site={me.siteName} />
      ) : (
        <form id="pw-form" onSubmit={submit} className="space-y-4">
          <p className="text-sm text-zinc-600">
            {action === 'disable'
              ? 'Your account will be protected by your password only.'
              : 'Your old backup codes stop working as soon as the new ones are created.'}
          </p>
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
          </Field>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        </form>
      )}
    </Modal>
  );
}

function Sessions() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await authClient.listSessions()).data ?? [],
  });
  const current = authClient.useSession().data?.session.id;
  const [busy, setBusy] = useState(false);
  const icon = (ua?: string | null) => (/(iphone|android|mobile)/i.test(ua ?? '') ? Smartphone : Monitor);
  const label = (ua?: string | null) => {
    if (!ua) return 'Unknown device';
    const browser = /edg\//i.test(ua) ? 'Edge' : /chrome\//i.test(ua) ? 'Chrome' : /firefox\//i.test(ua) ? 'Firefox' : /safari\//i.test(ua) ? 'Safari' : 'Browser';
    const os = /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'macOS' : /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iOS' : /linux/i.test(ua) ? 'Linux' : '';
    return os ? `${browser} on ${os}` : browser;
  };

  return (
    <Card
      title="Signed-in devices"
      description="Sessions last 7 days. Sign out everywhere else if you used a shared computer or lost a device."
      actions={
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          disabled={(data?.length ?? 0) < 2}
          onClick={async () => {
            setBusy(true);
            const { error } = await authClient.revokeOtherSessions();
            setBusy(false);
            if (error) toast.error(error.message ?? 'Could not sign out other devices');
            else toast.success('Other devices signed out');
            void refetch();
          }}
        >
          <LogOut className="size-4" /> Sign out other devices
        </Button>
      }
    >
      {isLoading ? (
        <Loading />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {(data ?? []).map((s) => {
            const Icon = icon(s.userAgent);
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                <Icon className="size-4 text-zinc-400" />
                <span className="flex-1">
                  {label(s.userAgent)} {s.id === current ? <Badge color="green">this device</Badge> : null}
                  <span className="block text-xs text-zinc-500">
                    {s.ipAddress || 'unknown IP'} · active {relative(s.updatedAt)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function AccountPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const params = useSearchParams();
  const mustSetUp = me.twoFactorRequired && !me.user.twoFactorEnabled;
  const [enabling, setEnabling] = useState(false);
  const [confirm, setConfirm] = useState<'disable' | 'codes' | null>(null);
  const [name, setName] = useState(me.user.name);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', repeat: '', revoke: true });
  const [savingPw, setSavingPw] = useState(false);
  const refreshMe = () => qc.invalidateQueries({ queryKey: ['me'] });

  useEffect(() => {
    if (params.get('setup') === '2fa' && !me.user.twoFactorEnabled) setEnabling(true);
  }, [params, me.user.twoFactorEnabled]);

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.repeat) return toast.error('The new passwords do not match');
    setSavingPw(true);
    const { error } = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next, revokeOtherSessions: pw.revoke });
    setSavingPw(false);
    if (error) return toast.error(errText(error, 'Could not change the password'));
    toast.success('Password changed');
    setPw({ current: '', next: '', repeat: '', revoke: true });
  }

  return (
    <>
      <PageHeader title="Account" description={me.user.email} />
      <div className="space-y-5">
        {mustSetUp ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Two-factor authentication is required</p>
              <p>An administrator requires every team member to use an authenticator app. Set it up to continue using the dashboard.</p>
            </div>
            <Button size="sm" onClick={() => setEnabling(true)}>
              Set up now
            </Button>
          </div>
        ) : null}

        <Card
          title="Two-factor authentication"
          description="A code from your phone is asked after your password, so a leaked password alone cannot open the dashboard."
        >
          {me.user.twoFactorEnabled ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge color="green">
                <ShieldCheck className="mr-1 size-3.5" /> On — authenticator app
              </Badge>
              <div className="flex-1" />
              <Button size="sm" variant="secondary" onClick={() => setConfirm('codes')}>
                <KeyRound className="size-4" /> New backup codes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={me.twoFactorRequired}
                title={me.twoFactorRequired ? 'Required for all team members (Settings → Security)' : undefined}
                onClick={() => setConfirm('disable')}
              >
                Turn off
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Badge color={mustSetUp ? 'yellow' : 'gray'}>Off</Badge>
              <div className="flex-1" />
              <Button size="sm" onClick={() => setEnabling(true)}>
                <ShieldCheck className="size-4" /> Set up
              </Button>
            </div>
          )}
        </Card>

        {!mustSetUp ? (
          <>
            <Card
              title="Profile"
              actions={
                <Button
                  size="sm"
                  loading={savingName}
                  disabled={!name.trim() || name === me.user.name}
                  onClick={async () => {
                    setSavingName(true);
                    const { error } = await authClient.updateUser({ name: name.trim() });
                    setSavingName(false);
                    if (error) toast.error(error.message ?? 'Could not save');
                    else (toast.success('Saved'), refreshMe());
                  }}
                >
                  Save
                </Button>
              }
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
                </Field>
                <Field label="E-mail" hint="Ask an admin to change it.">
                  <Input value={me.user.email} disabled />
                </Field>
              </div>
            </Card>

            <Card title="Password">
              <form onSubmit={savePassword} className="grid gap-5 md:grid-cols-3">
                <Field label="Current password">
                  <Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
                </Field>
                <Field label="New password" hint="At least 10 characters.">
                  <Input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
                </Field>
                <Field label="Repeat new password">
                  <Input type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} required />
                </Field>
                <div className="md:col-span-2">
                  <Switch checked={pw.revoke} onChange={(v) => setPw({ ...pw, revoke: v })} label="Sign out all other devices" />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" loading={savingPw}>
                    Change password
                  </Button>
                </div>
              </form>
            </Card>

            <Sessions />
          </>
        ) : null}
      </div>

      <EnableTwoFactor open={enabling} onClose={() => setEnabling(false)} onDone={refreshMe} />
      <ConfirmPassword action={confirm} onClose={() => setConfirm(null)} onDone={refreshMe} />
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <AccountPage />
    </Suspense>
  );
}
