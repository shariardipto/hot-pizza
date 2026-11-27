import { formatMoney, ORDER_STATUS_LABEL, type OrderStatus } from '@app/shared/commerce';
import { formatPhone } from '@app/shared/schemas';

/** Built-in e-mail copy. Add a language by adding a dictionary; unknown languages fall back to English. */
const DICT = {
  en: {
    hello: 'Hello',
    orderReceived: 'We have received your order',
    orderReceivedIntro: 'Thank you! Here is a summary of your order. We will let you know when its status changes.',
    orderUpdated: 'Your order has been updated',
    orderUpdatedIntro: 'The status of your order is now:',
    order: 'Order',
    item: 'Item',
    qty: 'Qty',
    subtotal: 'Subtotal',
    shipping: 'Delivery',
    codFee: 'Cash on delivery fee',
    tax: 'Tax',
    taxIncluded: 'incl.',
    total: 'Total',
    payment: 'Payment',
    cod: 'Cash on delivery',
    online: 'Online payment',
    pickup: 'Pick-up at',
    deliverTo: 'Delivery address',
    track: 'Track your order',
    reservationReceived: 'We have received your booking request',
    reservationConfirmed: 'Your table is confirmed',
    reservationCancelled: 'Your reservation has been cancelled',
    reservationIntro: 'Booking details:',
    guests: 'Guests',
    date: 'Date',
    time: 'Time',
    location: 'Location',
    manage: 'Manage or cancel your reservation',
    newOrder: 'New order',
    newReservation: 'New reservation',
    resetTitle: 'Reset your password',
    resetIntro: 'Someone requested a password reset for your admin account. If this was you, use the button below. The link expires in 1 hour.',
    resetCta: 'Choose a new password',
    footer: 'You receive this e-mail because of an order or booking on our website.',
  },
  es: {
    hello: 'Hola',
    orderReceived: 'Hemos recibido tu pedido',
    orderReceivedIntro: '¡Gracias! Este es el resumen de tu pedido. Te avisaremos cuando cambie su estado.',
    orderUpdated: 'Tu pedido se ha actualizado',
    orderUpdatedIntro: 'El estado de tu pedido es ahora:',
    order: 'Pedido',
    item: 'Producto',
    qty: 'Cant.',
    subtotal: 'Subtotal',
    shipping: 'Envío',
    codFee: 'Recargo contra reembolso',
    tax: 'Impuestos',
    taxIncluded: 'incl.',
    total: 'Total',
    payment: 'Pago',
    cod: 'Contra reembolso',
    online: 'Pago online',
    pickup: 'Recogida en',
    deliverTo: 'Dirección de entrega',
    track: 'Seguir mi pedido',
    reservationReceived: 'Hemos recibido tu solicitud de reserva',
    reservationConfirmed: 'Tu mesa está confirmada',
    reservationCancelled: 'Tu reserva ha sido cancelada',
    reservationIntro: 'Detalles de la reserva:',
    guests: 'Personas',
    date: 'Fecha',
    time: 'Hora',
    location: 'Local',
    manage: 'Gestionar o cancelar la reserva',
    newOrder: 'Nuevo pedido',
    newReservation: 'Nueva reserva',
    resetTitle: 'Restablece tu contraseña',
    resetIntro: 'Alguien ha solicitado restablecer la contraseña de tu cuenta. Si has sido tú, usa el botón. El enlace caduca en 1 hora.',
    resetCta: 'Elegir nueva contraseña',
    footer: 'Recibes este correo por un pedido o reserva en nuestra web.',
  },
} as const;
type Dict = Record<keyof (typeof DICT)['en'], string>;

const dict = (locale: string): Dict => (DICT as Record<string, Dict>)[locale.split('-')[0]!] ?? DICT.en;

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface Brand {
  name: string;
  accent: string;
  bg: string;
}

function layout(brand: Brand, title: string, body: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:${brand.bg};font-family:Helvetica,Arial,sans-serif;color:#222">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bg};padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${brand.accent};color:${brand.bg};padding:28px 32px;font-size:22px;letter-spacing:.04em;text-transform:uppercase;font-weight:700">${esc(brand.name)}</td></tr>
<tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:22px;text-transform:uppercase;color:${brand.accent}">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:20px 32px;font-size:12px;color:#888;border-top:1px solid #eee">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

const button = (brand: Brand, href: string, label: string) =>
  `<p style="margin:28px 0 8px"><a href="${esc(href)}" style="display:inline-block;background:${brand.accent};color:${brand.bg};text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:700;text-transform:uppercase;font-size:14px">${esc(label)}</a></p>`;

export interface OrderMailData {
  number: string;
  locale: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  currency: string;
  subtotal: number;
  shipping: number;
  codFee: number;
  tax: number;
  taxInclusive: boolean;
  total: number;
  paymentMethod: string;
  fulfillment: string;
  address: string | null;
  pickupLocation: string | null;
  notes: string | null;
  items: { name: string; quantity: number; lineTotal: number }[];
  trackingUrl: string;
  adminUrl?: string;
}

function orderTable(d: Dict, o: OrderMailData) {
  const m = (v: number) => formatMoney(v, o.currency, o.locale);
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 0;color:#555">${esc(label)}</td><td align="right" style="padding:6px 0;${bold ? 'font-weight:700' : ''}">${esc(value)}</td></tr>`;
  return `<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;margin:16px 0">
${o.items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(i.name)} × ${i.quantity}</td><td align="right" style="padding:8px 0;border-bottom:1px solid #eee">${m(i.lineTotal)}</td></tr>`).join('')}
${row(d.subtotal, m(o.subtotal))}
${o.shipping ? row(d.shipping, m(o.shipping)) : ''}
${o.codFee ? row(d.codFee, m(o.codFee)) : ''}
${o.tax ? row(o.taxInclusive ? `${d.tax} (${d.taxIncluded})` : d.tax, m(o.tax)) : ''}
${row(d.total, m(o.total), true)}
</table>`;
}

function orderMeta(d: Dict, o: OrderMailData) {
  return `<p style="font-size:14px;line-height:1.6;color:#444">
<strong>${esc(d.order)}:</strong> ${esc(o.number)}<br>
<strong>${esc(d.payment)}:</strong> ${esc(o.paymentMethod === 'cod' ? d.cod : d.online)}<br>
${o.pickupLocation ? `<strong>${esc(d.pickup)}:</strong> ${esc(o.pickupLocation)}` : `<strong>${esc(d.deliverTo)}:</strong> ${esc(o.address)}`}
</p>`;
}

export function orderConfirmationEmail(brand: Brand, o: OrderMailData) {
  const d = dict(o.locale);
  const subject = `${d.orderReceived} — ${o.number}`;
  const html = layout(
    brand,
    d.orderReceived,
    `<p style="font-size:15px;line-height:1.6">${esc(d.hello)} ${esc(o.customerName)},<br>${esc(d.orderReceivedIntro)}</p>${orderMeta(d, o)}${orderTable(d, o)}${button(brand, o.trackingUrl, d.track)}`,
    d.footer,
  );
  const text = `${d.orderReceived} — ${o.number}\n\n${o.items.map((i) => `${i.name} x${i.quantity}`).join('\n')}\n${d.total}: ${formatMoney(o.total, o.currency, o.locale)}\n\n${d.track}: ${o.trackingUrl}`;
  return { subject, html, text };
}

export function orderStatusEmail(brand: Brand, o: OrderMailData) {
  const d = dict(o.locale);
  const label = ORDER_STATUS_LABEL[o.status];
  const subject = `${d.orderUpdated} — ${o.number}: ${label}`;
  const html = layout(
    brand,
    d.orderUpdated,
    `<p style="font-size:15px;line-height:1.6">${esc(d.hello)} ${esc(o.customerName)},<br>${esc(d.orderUpdatedIntro)} <strong>${esc(label)}</strong></p>${orderMeta(d, o)}${button(brand, o.trackingUrl, d.track)}`,
    d.footer,
  );
  return { subject, html, text: `${subject}\n${d.track}: ${o.trackingUrl}` };
}

export function newOrderAdminEmail(brand: Brand, o: OrderMailData) {
  const d = DICT.en;
  const subject = `🛒 ${d.newOrder} ${o.number} — ${formatMoney(o.total, o.currency, 'en')} (${o.paymentMethod.toUpperCase()})`;
  const html = layout(
    brand,
    `${d.newOrder} ${o.number}`,
    `<p style="font-size:14px;line-height:1.6">${esc(o.customerName)} · ${esc(formatPhone(o.customerPhone))}${o.customerEmail ? ` · ${esc(o.customerEmail)}` : ''}</p>${orderMeta(d, o)}${o.notes ? `<p style="font-size:14px"><em>${esc(o.notes)}</em></p>` : ''}${orderTable(d, o)}${o.adminUrl ? button(brand, o.adminUrl, 'Open in admin') : ''}`,
    'Admin notification',
  );
  return { subject, html, text: `${subject}\n${o.adminUrl ?? ''}` };
}

export interface ReservationMailData {
  code: string;
  locale: string;
  status: 'pending' | 'confirmed' | 'cancelled' | string;
  name: string;
  phone: string;
  email: string | null;
  date: string;
  time: string;
  partySize: number;
  locationName: string;
  locationAddress: string;
  notes: string | null;
  manageUrl: string;
  adminUrl?: string;
}

function reservationDetails(d: Dict, r: ReservationMailData) {
  const dateLabel = (() => {
    try {
      return new Intl.DateTimeFormat(r.locale, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${r.date}T00:00:00Z`));
    } catch {
      return r.date;
    }
  })();
  return `<table role="presentation" width="100%" style="font-size:15px;margin:16px 0;line-height:1.8">
<tr><td style="color:#555">${esc(d.date)}</td><td align="right"><strong>${esc(dateLabel)}</strong></td></tr>
<tr><td style="color:#555">${esc(d.time)}</td><td align="right"><strong>${esc(r.time)}</strong></td></tr>
<tr><td style="color:#555">${esc(d.guests)}</td><td align="right"><strong>${r.partySize}</strong></td></tr>
<tr><td style="color:#555">${esc(d.location)}</td><td align="right"><strong>${esc(r.locationName)}</strong><br><span style="font-size:13px;color:#777">${esc(r.locationAddress)}</span></td></tr>
</table>`;
}

export function reservationEmail(brand: Brand, r: ReservationMailData) {
  const d = dict(r.locale);
  const title =
    r.status === 'confirmed' ? d.reservationConfirmed : r.status === 'cancelled' ? d.reservationCancelled : d.reservationReceived;
  const subject = `${title} — ${r.code}`;
  const html = layout(
    brand,
    title,
    `<p style="font-size:15px;line-height:1.6">${esc(d.hello)} ${esc(r.name)},<br>${esc(d.reservationIntro)}</p>${reservationDetails(d, r)}${r.status !== 'cancelled' ? button(brand, r.manageUrl, d.manage) : ''}`,
    d.footer,
  );
  return { subject, html, text: `${subject}\n${r.date} ${r.time} · ${r.partySize} · ${r.locationName}\n${r.manageUrl}` };
}

export function newReservationAdminEmail(brand: Brand, r: ReservationMailData) {
  const d = DICT.en;
  const subject = `📅 ${d.newReservation} ${r.code} — ${r.date} ${r.time}, ${r.partySize} guests`;
  const html = layout(
    brand,
    `${d.newReservation} ${r.code}`,
    `<p style="font-size:14px">${esc(r.name)} · ${esc(formatPhone(r.phone))}${r.email ? ` · ${esc(r.email)}` : ''}</p>${reservationDetails(d, r)}${r.notes ? `<p><em>${esc(r.notes)}</em></p>` : ''}${r.adminUrl ? button(brand, r.adminUrl, 'Open in admin') : ''}`,
    'Admin notification',
  );
  return { subject, html, text: subject };
}

export function passwordResetEmail({ name, url }: { name: string; url: string }) {
  const d = DICT.en;
  const brand = { name: 'Admin', accent: '#d70321', bg: '#fbf5e7' };
  return {
    subject: d.resetTitle,
    html: layout(brand, d.resetTitle, `<p style="font-size:15px;line-height:1.6">${esc(d.hello)} ${esc(name)},<br>${esc(d.resetIntro)}</p>${button(brand, url, d.resetCta)}`, ''),
    text: `${d.resetTitle}\n${url}`,
  };
}
