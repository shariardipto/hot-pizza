import { z } from 'zod';
import { PAYMENT_METHODS } from '../commerce/markets';
import { addressFormat } from '../i18n/address';
import { countryCode, isValidPhone, localeCode, optionalEmail, personName, phoneInput } from './common';

export const addressSchema = z.object({
  line1: z.string().trim().min(3, { message: 'required' }).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, { message: 'required' }).max(120),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: countryCode,
});
export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutSchema = z
  .object({
    /** Country used to pick the market (delivery country, or visitor country for pick-up). */
    country: countryCode,
    locale: localeCode,
    items: z.array(checkoutItemSchema).min(1).max(50),
    customer: z.object({ name: personName, phone: phoneInput, email: optionalEmail }),
    fulfillment: z.enum(['delivery', 'pickup']),
    address: addressSchema.optional(),
    pickupLocationId: z.string().optional(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    notes: z.string().trim().max(1000).optional(),
    acceptTerms: z.literal(true, { message: 'required' }),
  })
  .superRefine((v, ctx) => {
    const phoneCountry = v.address?.country ?? v.country;
    if (!isValidPhone(v.customer.phone, phoneCountry)) {
      ctx.addIssue({ code: 'custom', path: ['customer', 'phone'], message: 'phone' });
    }
    if (v.fulfillment === 'delivery') {
      if (!v.address) {
        ctx.addIssue({ code: 'custom', path: ['address'], message: 'required' });
        return;
      }
      if (v.address.country !== v.country) {
        ctx.addIssue({ code: 'custom', path: ['address', 'country'], message: 'invalid' });
      }
      const fmt = addressFormat(v.address.country);
      if (fmt.regionRequired && !v.address.region) {
        ctx.addIssue({ code: 'custom', path: ['address', 'region'], message: 'required' });
      }
      const postal = v.address.postalCode?.trim();
      if (fmt.postal && fmt.postalRequired && !postal) {
        ctx.addIssue({ code: 'custom', path: ['address', 'postalCode'], message: 'required' });
      } else if (postal && fmt.postalPattern && !fmt.postalPattern.test(postal)) {
        ctx.addIssue({ code: 'custom', path: ['address', 'postalCode'], message: 'postal' });
      }
    } else if (!v.pickupLocationId) {
      ctx.addIssue({ code: 'custom', path: ['pickupLocationId'], message: 'required' });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Body for the price preview endpoint (same rules, no customer data). */
export const quoteSchema = z.object({
  country: countryCode,
  items: z.array(checkoutItemSchema).max(50),
  fulfillment: z.enum(['delivery', 'pickup']).default('delivery'),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
});
export type QuoteInput = z.infer<typeof quoteSchema>;
