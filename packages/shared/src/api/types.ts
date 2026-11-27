import type { Fulfillment, Market, PaymentMethod, PaymentProvider, Totals } from '../commerce/markets';
import type { OrderStatus, PaymentStatus, ReservationStatus } from '../commerce/status';
import type { OpeningHours, TimeSlot } from '../schemas/reservation';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: (string | number)[]; message: string }[] };
}

export interface PublicLocation {
  id: string;
  name: string;
  slug: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  timezone: string;
  acceptsReservations: boolean;
  acceptsPickup: boolean;
  openingHours: OpeningHours;
  minPartySize: number;
  maxPartySize: number;
  maxAdvanceDays: number;
}

/** Market info safe to expose publicly. */
export type PublicMarket = Pick<
  Market,
  | 'id'
  | 'code'
  | 'name'
  | 'currency'
  | 'countries'
  | 'taxRate'
  | 'taxInclusive'
  | 'taxLabel'
  | 'deliveryEnabled'
  | 'pickupEnabled'
  | 'shippingFee'
  | 'freeShippingThreshold'
  | 'minOrderAmount'
  | 'codEnabled'
  | 'codFee'
  | 'codMaxAmount'
> & { paymentMethods: PaymentMethod[] };

export interface MarketResolution {
  country: string;
  market: PublicMarket;
  pickupLocations: PublicLocation[];
  stripePublishableKey: string | null;
}

export interface QuoteLine {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: boolean;
  maxQuantity: number;
}

export interface Quote {
  country: string;
  market: PublicMarket;
  lines: QuoteLine[];
  totals: Totals;
  paymentMethods: PaymentMethod[];
  codUnavailableReason: 'market' | 'limit' | null;
  belowMinimum: boolean;
}

export interface PublicOrderItem {
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PublicOrder {
  number: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  fulfillment: Fulfillment;
  currency: string;
  subtotal: number;
  shipping: number;
  codFee: number;
  tax: number;
  taxInclusive: boolean;
  total: number;
  customerName: string;
  items: PublicOrderItem[];
  address: { line1: string; line2: string | null; city: string; region: string | null; postalCode: string | null; country: string } | null;
  pickupLocation: { name: string; addressLine1: string; city: string } | null;
  createdAt: string;
  timeline: { status: string; at: string }[];
}

export type PaymentAction =
  | { type: 'none' }
  | { type: 'stripe'; clientSecret: string; publishableKey: string }
  | { type: 'redirect'; url: string }
  | {
      type: 'razorpay';
      keyId: string;
      orderId: string;
      amount: number;
      currency: string;
      name: string;
      prefill: { name: string; contact: string; email?: string };
    };

export interface CreateOrderResponse {
  order: { number: string; token: string; status: OrderStatus; paymentStatus: PaymentStatus; total: number; currency: string };
  payment: PaymentAction;
  /** Public tracking URL path on the website, e.g. /order/PZ-10001?token=… */
  trackingPath: string;
}

export interface PublicReservation {
  code: string;
  status: ReservationStatus;
  date: string;
  time: string;
  partySize: number;
  name: string;
  location: { name: string; addressLine1: string; city: string; phone: string | null };
  canCancel: boolean;
}

export interface CreateReservationResponse {
  reservation: PublicReservation;
  token: string;
  managePath: string;
}

export interface AvailabilityResponse {
  date: string;
  timezone: string;
  closed: boolean;
  slots: TimeSlot[];
}

export type { PaymentProvider };
