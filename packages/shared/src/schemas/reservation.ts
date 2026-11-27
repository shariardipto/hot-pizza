import { z } from 'zod';
import { countryCode, isValidPhone, localeCode, optionalEmail, personName, phoneInput } from './common';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'invalid' });
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'invalid' });

export const reservationSchema = z
  .object({
    locationId: z.string().min(1, { message: 'required' }),
    date: isoDate,
    time: hhmm,
    partySize: z.number().int().min(1).max(100),
    name: personName,
    phone: phoneInput,
    /** Country used to interpret a phone number entered without +prefix. */
    phoneCountry: countryCode,
    email: optionalEmail,
    notes: z.string().trim().max(1000).optional(),
    locale: localeCode,
  })
  .superRefine((v, ctx) => {
    if (!isValidPhone(v.phone, v.phoneCountry)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'phone' });
  });

export type ReservationInput = z.infer<typeof reservationSchema>;

export const availabilityQuerySchema = z.object({
  locationId: z.string().min(1),
  date: isoDate,
  partySize: z.coerce.number().int().min(1).max(100),
});

/** Opening hours: weekday 0 (Sunday) … 6 → list of service windows. */
export const openingHoursSchema = z.record(
  z.enum(['0', '1', '2', '3', '4', '5', '6']),
  z.array(z.object({ open: hhmm, close: hhmm })).max(4),
);
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export interface TimeSlot {
  time: string;
  available: boolean;
  remaining: number;
}
