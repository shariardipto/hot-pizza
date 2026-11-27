'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Field, Input, Loading, Modal, PageHeader, Switch } from '@/components/ui';
import { del, errorMessage, get, post, put } from '@/lib/api';

type Hours = Record<string, { open: string; close: string }[]>;
interface Loc {
  id: string;
  slug: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  acceptsReservations: boolean;
  acceptsPickup: boolean;
  openingHours: Hours;
  slotInterval: number;
  reservationDuration: number;
  maxCovers: number;
  minPartySize: number;
  maxPartySize: number;
  leadTimeMinutes: number;
  maxAdvanceDays: number;
  autoConfirm: boolean;
  closedDates: string[];
  sortOrder: number;
}
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_KEY = ['1', '2', '3', '4', '5', '6', '0'];
const EMPTY: Loc = {
  id: '',
  slug: '',
  name: '',
  addressLine1: '',
  addressLine2: null,
  city: '',
  region: null,
  postalCode: null,
  country: 'ES',
  phone: null,
  email: null,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  latitude: null,
  longitude: null,
  isActive: true,
  acceptsReservations: true,
  acceptsPickup: false,
  openingHours: Object.fromEntries(DAY_KEY.map((d) => [d, [{ open: '12:00', close: '16:00' }]])),
  slotInterval: 30,
  reservationDuration: 90,
  maxCovers: 40,
  minPartySize: 1,
  maxPartySize: 12,
  leadTimeMinutes: 60,
  maxAdvanceDays: 60,
  autoConfirm: false,
  closedDates: [],
  sortOrder: 0,
};

function LocationForm({ loc, onClose }: { loc: Loc; onClose: () => void }) {
  const qc = useQueryClient();
  const [l, setL] = useState<Loc>(loc);
  const [closed, setClosed] = useState('');
  const set = <K extends keyof Loc>(k: K, v: Loc[K]) => setL({ ...l, [k]: v });
  const setDay = (d: string, v: { open: string; close: string }[]) => set('openingHours', { ...l.openingHours, [d]: v });
  const save = useMutation({
    mutationFn: () => {
      const { id, ...body } = l;
      return id ? put(`/locations/${id}`, body) : post('/locations', body);
    },
    onSuccess: () => (toast.success('Location saved'), qc.invalidateQueries({ queryKey: ['locations'] }), onClose()),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => del(`/locations/${l.id}`),
    onSuccess: () => (toast.success('Deleted'), qc.invalidateQueries({ queryKey: ['locations'] }), onClose()),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const n = (v: string) => (v === '' ? null : v);
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={l.id ? `Edit ${l.name}` : 'New location'}
      footer={
        <>
          {l.id ? (
            <Button variant="danger" onClick={() => window.confirm('Delete this location?') && remove.mutate()} loading={remove.isPending}>
              Delete
            </Button>
          ) : null}
          <span className="flex-1" />
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save location
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Name" className="md:col-span-2">
            <Input value={l.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Slug">
            <Input value={l.slug} onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
          </Field>
          <Field label="Street" className="md:col-span-2">
            <Input value={l.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} />
          </Field>
          <Field label="Address line 2">
            <Input value={l.addressLine2 ?? ''} onChange={(e) => set('addressLine2', n(e.target.value))} />
          </Field>
          <Field label="City">
            <Input value={l.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Postal code">
            <Input value={l.postalCode ?? ''} onChange={(e) => set('postalCode', n(e.target.value))} />
          </Field>
          <Field label="Region">
            <Input value={l.region ?? ''} onChange={(e) => set('region', n(e.target.value))} />
          </Field>
          <Field label="Country (ISO)">
            <Input maxLength={2} value={l.country} onChange={(e) => set('country', e.target.value.toUpperCase())} />
          </Field>
          <Field label="Time zone" hint="Booking times use this zone.">
            <Input value={l.timezone} onChange={(e) => set('timezone', e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={l.phone ?? ''} onChange={(e) => set('phone', n(e.target.value))} />
          </Field>
          <Field label="E-mail" hint="Receives this location's bookings.">
            <Input value={l.email ?? ''} onChange={(e) => set('email', n(e.target.value))} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Switch checked={l.isActive} onChange={(v) => set('isActive', v)} label="Active" />
          <Switch checked={l.acceptsReservations} onChange={(v) => set('acceptsReservations', v)} label="Online reservations" />
          <Switch checked={l.acceptsPickup} onChange={(v) => set('acceptsPickup', v)} label="Order pick-up point" />
          <Switch checked={l.autoConfirm} onChange={(v) => set('autoConfirm', v)} label="Auto-confirm bookings" />
        </div>
        <fieldset className="rounded-xl border border-zinc-200 p-4">
          <legend className="px-1 text-sm font-semibold">Opening hours (services)</legend>
          <div className="space-y-2">
            {DAY_KEY.map((d, i) => {
              const windows = l.openingHours[d] ?? [];
              return (
                <div key={d} className="flex flex-wrap items-center gap-2">
                  <span className="w-24 text-sm">{DAYS[i]}</span>
                  {windows.length ? null : <span className="text-sm text-zinc-400">Closed</span>}
                  {windows.map((w, k) => (
                    <span key={k} className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1">
                      <input type="time" className="text-sm" value={w.open} onChange={(e) => setDay(d, windows.map((x, j) => (j === k ? { ...x, open: e.target.value } : x)))} />–
                      <input type="time" className="text-sm" value={w.close} onChange={(e) => setDay(d, windows.map((x, j) => (j === k ? { ...x, close: e.target.value } : x)))} />
                      <button type="button" onClick={() => setDay(d, windows.filter((_, j) => j !== k))} className="text-zinc-400 hover:text-red-600">
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                  {windows.length < 4 ? (
                    <Button size="sm" variant="ghost" onClick={() => setDay(d, [...windows, { open: windows.length ? '20:00' : '13:00', close: windows.length ? '23:00' : '16:00' }])}>
                      <Plus className="size-3.5" /> service
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="grid gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-4">
          <legend className="px-1 text-sm font-semibold">Bookings</legend>
          <Field label="Slot every (min)">
            <Input type="number" min={5} value={l.slotInterval} onChange={(e) => set('slotInterval', Number(e.target.value))} />
          </Field>
          <Field label="Table time (min)">
            <Input type="number" min={15} value={l.reservationDuration} onChange={(e) => set('reservationDuration', Number(e.target.value))} />
          </Field>
          <Field label="Seats at the same time">
            <Input type="number" min={1} value={l.maxCovers} onChange={(e) => set('maxCovers', Number(e.target.value))} />
          </Field>
          <Field label="Book at least (min) ahead">
            <Input type="number" min={0} value={l.leadTimeMinutes} onChange={(e) => set('leadTimeMinutes', Number(e.target.value))} />
          </Field>
          <Field label="Min. guests online">
            <Input type="number" min={1} value={l.minPartySize} onChange={(e) => set('minPartySize', Number(e.target.value))} />
          </Field>
          <Field label="Max. guests online">
            <Input type="number" min={1} value={l.maxPartySize} onChange={(e) => set('maxPartySize', Number(e.target.value))} />
          </Field>
          <Field label="Book up to (days) ahead">
            <Input type="number" min={1} value={l.maxAdvanceDays} onChange={(e) => set('maxAdvanceDays', Number(e.target.value))} />
          </Field>
        </fieldset>
        <Field label="Closed dates (holidays)">
          <div className="flex flex-wrap items-center gap-2">
            {l.closedDates.map((d) => (
              <Badge key={d}>
                {d}
                <button type="button" className="ml-1" onClick={() => set('closedDates', l.closedDates.filter((x) => x !== d))}>
                  ×
                </button>
              </Badge>
            ))}
            <Input type="date" className="w-44" value={closed} onChange={(e) => setClosed(e.target.value)} />
            <Button size="sm" variant="secondary" disabled={!closed} onClick={() => (set('closedDates', [...new Set([...l.closedDates, closed])].sort()), setClosed(''))}>
              Add
            </Button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}

export default function LocationsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ['locations'], queryFn: () => get<Loc[]>('/locations') });
  const [editing, setEditing] = useState<Loc | null>(null);
  if (isLoading) return <Loading />;
  return (
    <>
      <PageHeader
        title="Locations"
        description="Restaurants / shops: opening hours and capacity for reservations, and pick-up points for orders."
        actions={
          <Button onClick={() => setEditing(EMPTY)}>
            <Plus className="size-4" /> New location
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((l) => (
          <button key={l.id} type="button" onClick={() => setEditing(l)} className="card flex gap-4 p-5 text-left hover:border-zinc-400">
            <MapPin className="mt-0.5 size-5 text-brand" />
            <div className="flex-1">
              <p className="font-semibold">{l.name}</p>
              <p className="text-sm text-zinc-500">
                {l.addressLine1}, {l.postalCode} {l.city} · {l.country}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {!l.isActive ? <Badge>inactive</Badge> : null}
                {l.acceptsReservations ? <Badge color="green">reservations · {l.maxCovers} seats</Badge> : null}
                {l.acceptsPickup ? <Badge color="blue">pick-up</Badge> : null}
                <Badge>{l.timezone}</Badge>
              </div>
            </div>
          </button>
        ))}
      </div>
      {editing ? <LocationForm loc={editing} onClose={() => setEditing(null)} /> : null}
      {!data.length ? <p className="text-sm text-zinc-500">No locations yet.</p> : null}
    </>
  );
}
