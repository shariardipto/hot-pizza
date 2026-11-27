'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RESERVATION_STATUS_LABEL, type ReservationStatus } from '@app/shared/commerce';
import { formatPhone } from '@app/shared/schemas';
import { Badge, Button, Card, Field, Input, Loading, PageHeader, STATUS_COLOR, Switch, Textarea } from '@/components/ui';
import { errorMessage, get, patch, post } from '@/lib/api';
import { useMe } from '@/lib/me';
import { dateTime } from '@/lib/utils';

interface Res {
  id: string;
  code: string;
  status: ReservationStatus;
  date: string;
  time: string;
  partySize: number;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  internalNote: string | null;
  source: string;
  locale: string;
  createdAt: string;
  location: { id: string; name: string; timezone: string };
  events: { id: string; type: string; toValue: string | null; message: string | null; actorName: string | null; createdAt: string }[];
  allowedTransitions: ReservationStatus[];
}

const LABEL: Partial<Record<ReservationStatus, string>> = { confirmed: 'Confirm', seated: 'Seat guests', completed: 'Complete', cancelled: 'Cancel', no_show: 'No-show' };

export default function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { can } = useMe();
  const { data: r, isLoading } = useQuery({ queryKey: ['reservation', id], queryFn: () => get<Res>(`/reservations/${id}`) });
  const [edit, setEdit] = useState({ date: '', time: '', partySize: 2, internalNote: '', force: false });
  useEffect(() => {
    if (r) setEdit({ date: r.date, time: r.time, partySize: r.partySize, internalNote: r.internalNote ?? '', force: false });
  }, [r]);
  const done = (d: Res) => {
    qc.setQueryData(['reservation', id], d);
    qc.invalidateQueries({ queryKey: ['reservations'] });
    qc.invalidateQueries({ queryKey: ['res-cal'] });
  };
  const status = useMutation({
    mutationFn: (s: ReservationStatus) => post<Res>(`/reservations/${id}/status`, { status: s }),
    onSuccess: (d) => (done(d), toast.success(`Reservation ${RESERVATION_STATUS_LABEL[d.status].toLowerCase()}`)),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const save = useMutation({
    mutationFn: () => patch<Res>(`/reservations/${id}`, { ...edit, internalNote: edit.internalNote || null }),
    onSuccess: (d) => (done(d), toast.success('Saved')),
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (isLoading || !r) return <Loading />;
  const manage = can('reservations.manage');
  return (
    <>
      <PageHeader
        back={
          <Link href={`/reservations?date=${r.date}`} className="mb-2 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
            <ArrowLeft className="size-3.5" /> Reservations
          </Link>
        }
        title={
          <span className="flex items-center gap-3">
            {r.name} · {r.partySize} guests <Badge color={STATUS_COLOR[r.status]}>{RESERVATION_STATUS_LABEL[r.status]}</Badge>
          </span>
        }
        description={`${new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${r.date}T00:00:00Z`))} at ${r.time} · ${r.location.name} · ${r.code} · via ${r.source}`}
        actions={
          manage
            ? r.allowedTransitions.map((s) => (
                <Button key={s} variant={s === 'cancelled' || s === 'no_show' ? 'danger' : 'primary'} loading={status.isPending && status.variables === s} onClick={() => status.mutate(s)}>
                  {LABEL[s] ?? s}
                </Button>
              ))
            : null
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          {manage ? (
            <Card title="Reschedule">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Date">
                  <Input type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />
                </Field>
                <Field label="Time">
                  <Input type="time" step={900} value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} />
                </Field>
                <Field label="Guests">
                  <Input type="number" min={1} value={edit.partySize} onChange={(e) => setEdit({ ...edit, partySize: Number(e.target.value) })} />
                </Field>
                <Field label="Internal note" className="sm:col-span-3">
                  <Textarea value={edit.internalNote} onChange={(e) => setEdit({ ...edit, internalNote: e.target.value })} placeholder="Table number, allergies, VIP…" />
                </Field>
                <div className="sm:col-span-2">
                  <Switch checked={edit.force} onChange={(v) => setEdit({ ...edit, force: v })} label="Allow over capacity" />
                </div>
                <Button onClick={() => save.mutate()} loading={save.isPending}>
                  Save changes
                </Button>
              </div>
            </Card>
          ) : null}
          <Card title="History">
            <ol className="space-y-3 text-sm">
              {r.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                  <div>
                    <p>
                      <span className="font-medium capitalize">{e.type}</span>
                      {e.toValue ? ` → ${e.toValue}` : ''}
                      {e.message ? <span className="text-zinc-600"> — {e.message}</span> : null}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {dateTime(e.createdAt)}
                      {e.actorName ? ` · ${e.actorName}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <Card title="Guest">
          <div className="space-y-2 text-sm">
            <p className="font-medium">{r.name}</p>
            <a href={`tel:${r.phone}`} className="flex items-center gap-2 hover:text-brand">
              <Phone className="size-4" /> {formatPhone(r.phone)}
            </a>
            {r.email ? (
              <a href={`mailto:${r.email}`} className="flex items-center gap-2 hover:text-brand">
                <Mail className="size-4" /> {r.email}
              </a>
            ) : null}
            {r.notes ? <p className="rounded-lg bg-amber-50 p-3 text-amber-900">“{r.notes}”</p> : null}
            <p className="text-xs text-zinc-500">
              Booked {dateTime(r.createdAt)} · language {r.locale}
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
