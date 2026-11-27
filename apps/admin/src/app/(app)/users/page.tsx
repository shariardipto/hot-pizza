'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, ShieldOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, Field, Input, Loading, Modal, PageHeader, Select, Table } from '@/components/ui';
import { del, errorMessage, get, patch, post } from '@/lib/api';
import { useMe } from '@/lib/me';
import { relative } from '@/lib/utils';

interface U {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean | null;
  twoFactorEnabled: boolean | null;
  createdAt: string;
  sessions: { updatedAt: string }[];
}
const ROLES = [
  { value: 'admin', label: 'Admin — everything' },
  { value: 'editor', label: 'Editor — content, media, appearance' },
  { value: 'staff', label: 'Staff — orders & reservations' },
];

export default function UsersPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['users'], queryFn: () => get<U[]>('/users') });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [pw, setPw] = useState<{ id: string; value: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  const create = useMutation({ mutationFn: () => post('/users', form), onSuccess: () => (toast.success('User created'), refresh(), setCreating(false)), onError: (e) => toast.error(errorMessage(e)) });
  const setRole = useMutation({ mutationFn: ({ id, role }: { id: string; role: string }) => patch(`/users/${id}`, { role }), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const ban = useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => post(`/users/${id}/${on ? 'ban' : 'unban'}`), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/users/${id}`), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const resetTwoFactor = useMutation({ mutationFn: (id: string) => post(`/users/${id}/two-factor/reset`), onSuccess: () => (toast.success('Two-factor removed — they can set it up again from their account'), refresh()), onError: (e) => toast.error(errorMessage(e)) });
  const setPassword = useMutation({ mutationFn: () => post(`/users/${pw!.id}/password`, { password: pw!.value }), onSuccess: () => (toast.success('Password changed'), setPw(null)), onError: (e) => toast.error(errorMessage(e)) });

  return (
    <>
      <PageHeader
        title="Team"
        description="People who can sign in to this dashboard. Customers never need an account."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add member
          </Button>
        }
      />
      <Card bodyClassName="p-0">
        {isLoading ? (
          <Loading />
        ) : (
          <Table head={['Name', 'Role', 'Last active', 'Two-factor', 'Status', '']}>
            {data.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {u.name} {u.id === me.user.id ? <Badge>you</Badge> : null}
                  </p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Select className="w-64" value={u.role} disabled={u.id === me.user.id} onChange={(e) => setRole.mutate({ id: u.id, role: e.target.value })}>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-4 py-3 text-zinc-500">{u.sessions[0] ? relative(u.sessions[0].updatedAt) : 'never'}</td>
                <td className="px-4 py-3">{u.twoFactorEnabled ? <Badge color="green">on</Badge> : <Badge color={me.twoFactorRequired ? 'yellow' : 'gray'}>off</Badge>}</td>
                <td className="px-4 py-3">{u.banned ? <Badge color="red">disabled</Badge> : <Badge color="green">active</Badge>}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setPw({ id: u.id, value: '' })} title="Set password">
                    <KeyRound className="size-4" />
                  </Button>
                  {u.twoFactorEnabled && u.id !== me.user.id ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Reset two-factor (lost phone)"
                      onClick={() => window.confirm(`Remove two-factor for ${u.name}? They will be signed out and can set it up again.`) && resetTwoFactor.mutate(u.id)}
                    >
                      <ShieldOff className="size-4" />
                    </Button>
                  ) : null}
                  {u.id !== me.user.id ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => ban.mutate({ id: u.id, on: !u.banned })}>
                        {u.banned ? 'Enable' : 'Disable'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => window.confirm(`Delete ${u.name}?`) && remove.mutate(u.id)}>
                        <Trash2 className="size-4 text-red-600" />
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add team member"
        footer={
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            Create
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Temporary password" hint="At least 10 characters. Ask them to change it via “Forgot password”.">
            <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
      <Modal
        open={Boolean(pw)}
        onClose={() => setPw(null)}
        title="Set a new password"
        footer={
          <Button onClick={() => setPassword.mutate()} loading={setPassword.isPending} disabled={(pw?.value.length ?? 0) < 10}>
            Save
          </Button>
        }
      >
        <Field label="New password" hint="At least 10 characters.">
          <Input value={pw?.value ?? ''} onChange={(e) => setPw(pw ? { ...pw, value: e.target.value } : null)} />
        </Field>
      </Modal>
    </>
  );
}
