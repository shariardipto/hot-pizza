'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { RESERVATION_STATUS_LABEL, RESERVATION_STATUSES, type ReservationStatus } from '@app/shared/commerce';
import { formatPhone } from '@app/shared/schemas';
import { Badge, Button, Card, Field, Input, Loading, Modal, PageHeader, Select, STATUS_COLOR, Switch, Table, Textarea } from '@/components/ui';
import { errorMessage, get, post, qs } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Location {
  id: string;
  name: string;
  timezone: string;
  country: string;
  minPartySize: number;
  maxPartySize: number;
}
interface Row {
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
  source: string;
  location: { name: string };
}

const today = () => new Date().toISOString().slice(0, 10);
const addMonths = (m: string, d: number) => {
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const dt = new Date(Date.UTC(y, mo - 1 + d, 1));
  return dt.toISOString().slice(0, 7);
};

function Calendar({ month, locationId, selected, onSelect }: { month: string; locationId: string; selected: string; onSelect: (d: string) => void }) {
  const { data = {} } = useQuery({ queryKey: ['res-cal', month, locationId], queryFn: () => get<Record<string, { bookings: number; guests: number; pending: number }>>(`/reservations/calendar${qs({ month, locationId })}`) });
  const days = useMemo(() => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const first = new Date(Date.UTC(y, m - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7; // Monday first
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  }, [month]);
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
        <span key={d} className="py-1 font-medium text-zinc-500">
          {d}
        </span>
      ))}
      {days.map((d, i) =>
        d ? (
          <button
            key={d}
            type="button"
            onClick={() => onSelect(d)}
            className={cn('flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition', d === selected ? 'border-brand bg-brand text-white' : 'border-zinc-200 hover:border-zinc-400', d === today() && d !== selected && 'border-brand/60')}
          >
            <span className="font-medium">{Number(d.slice(8))}</span>
            {data[d] ? (
              <span className={cn('text-[10px]', d === selected ? 'text-white/80' : 'text-zinc-500')}>
                {data[d]!.bookings} · {data[d]!.guests}p{data[d]!.pending ? ' •' : ''}
              </span>
            ) : null}
          </button>
        ) : (
          <span key={`e${i}`} />
        ),
      )}
    </div>
  );
}

function NewBooking({ open, onClose, locations }: { open: boolean; onClose: () => void; locations: Location[] }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ locationId: locations[0]?.id ?? '', date: today(), time: '20:00', partySize: 2, name: '', phone: '', email: '', notes: '', force: false });
  const loc = locations.find((l) => l.id === f.locationId);
  const create = useMutation({
    mutationFn: () => post('/reservations', { ...f, phoneCountry: loc?.country ?? 'ES', email: f.email || undefined, notes: f.notes || undefined, locale: 'en', source: 'phone' }),
    onSuccess: () => {
      toast.success('Booking created');
      qc.invalidateQueries({ queryKey: ['reservations'] });
      qc.invalidateQueries({ queryKey: ['res-cal'] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New booking (phone / walk-in)"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            Create booking
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Location" className="sm:col-span-2">
          <Select value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
        <Field label="Time">
          <Input type="time" step={900} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
        </Field>
        <Field label="Guests">
          <Input type="number" min={1} value={f.partySize} onChange={(e) => setF({ ...f, partySize: Number(e.target.value) })} />
        </Field>
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Phone" hint={`Local numbers are read as ${loc?.country ?? '—'}.`}>
          <Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="E-mail (optional)">
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <div className="sm:col-span-2">
          <Switch checked={f.force} onChange={(v) => setF({ ...f, force: v })} label="Ignore opening hours & capacity" description="Use for special arrangements (overbooking)." />
        </div>
      </div>
    </Modal>
  );
}

function Reservations() {
  const params = useSearchParams();
  const router = useRouter();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [creating, setCreating] = useState(false);
  const date = params.get('date') ?? (params.get('status') ? '' : today());
  const status = params.get('status') ?? '';
  const locationId = params.get('location') ?? '';
  const set = (p: Record<string, string>) => router.replace(`/reservations${qs({ date, status, location: locationId, ...p })}`);
  const { data: locations = [] } = useQuery({ queryKey: ['locations'], queryFn: () => get<Location[]>('/locations') });
  const { data, isLoading } = useQuery({
    queryKey: ['reservations', date, status, locationId],
    queryFn: () => get<{ items: Row[]; total: number }>(`/reservations${qs({ from: date || (status ? today() : ''), to: date, status, locationId, pageSize: 200 })}`),
    refetchInterval: 30_000,
  });
  const guests = data?.items.filter((r) => r.status !== 'cancelled').reduce((s, r) => s + r.partySize, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Table bookings from the website and by phone."
        actions={
          <Button onClick={() => setCreating(true)} disabled={!locations.length}>
            <Plus className="size-4" /> New booking
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
        <Card
          title={new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))}
          actions={
            <>
              <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Button>
            </>
          }
        >
          <Calendar month={month} locationId={locationId} selected={date} onSelect={(d) => set({ date: d, status: '' })} />
          <div className="mt-4 space-y-3">
            {locations.length > 1 ? (
              <Select value={locationId} onChange={(e) => set({ location: e.target.value })}>
                <option value="">All locations</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select value={status} onChange={(e) => set({ status: e.target.value, date: e.target.value ? '' : today() })}>
              <option value="">Any status</option>
              {RESERVATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {RESERVATION_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
        </Card>
        <Card
          title={date ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)) : `${RESERVATION_STATUS_LABEL[status as ReservationStatus] ?? 'All'} bookings`}
          description={data ? `${data.items.length} booking(s) · ${guests} guests` : undefined}
          bodyClassName="p-0"
        >
          {isLoading || !data ? (
            <Loading />
          ) : (
            <Table head={['Time', 'Guest', 'Party', 'Location', 'Status']} empty={!data.items.length}>
              {data.items.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-zinc-50" onClick={() => router.push(`/reservations/${r.id}`)}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {!date ? <span className="mr-2 text-zinc-500">{r.date}</span> : null}
                    {r.time}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/reservations/${r.id}`} className="font-medium">
                      {r.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {formatPhone(r.phone)} · {r.code}
                      {r.notes ? ' · 📝' : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.partySize}</td>
                  <td className="px-4 py-3 text-zinc-600">{r.location.name}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[r.status]}>{RESERVATION_STATUS_LABEL[r.status]}</Badge>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
      {creating ? <NewBooking open={creating} onClose={() => setCreating(false)} locations={locations} /> : null}
    </>
  );
}

export default function ReservationsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Reservations />
    </Suspense>
  );
}
