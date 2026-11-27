import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === '1' || v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  API_URL: z.string().default('http://localhost:4000'),
  WEB_URL: z.string().default('http://localhost:3000'),
  ADMIN_URL: z.string().default('http://localhost:3001'),
  MEDIA_PUBLIC_URL: z.string().optional().default(''),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  REVALIDATE_SECRET: z.string().optional().default(''),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_BUCKET: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('auto'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_PUBLIC_URL: z.string().optional().default(''),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  /** PayPal REST app (https://developer.paypal.com/dashboard/applications). Sandbox unless PAYPAL_SANDBOX=false. */
  PAYPAL_CLIENT_ID: z.string().optional().default(''),
  PAYPAL_CLIENT_SECRET: z.string().optional().default(''),
  PAYPAL_WEBHOOK_ID: z.string().optional().default(''),
  /** Testing only: send PayPal API calls to another host (e.g. a local mock). */
  PAYPAL_API_URL: z.string().optional().default(''),
  PAYPAL_SANDBOX: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
  SSLCOMMERZ_STORE_ID: z.string().optional().default(''),
  SSLCOMMERZ_STORE_PASSWORD: z.string().optional().default(''),
  /** Cloudflare Turnstile bot check on checkout & bookings (https://dash.cloudflare.com → Turnstile). */
  TURNSTILE_SITE_KEY: z.string().optional().default(''),
  TURNSTILE_SECRET_KEY: z.string().optional().default(''),
  SSLCOMMERZ_SANDBOX: z
    .string()
    .optional()
    .transform((v) => v !== 'false' && v !== '0'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_SECURE: bool,
  MAIL_FROM: z.string().default('no-reply@example.com'),
  /** Optional: shared rate-limit counters when running several API servers (redis://host:6379). */
  REDIS_URL: z.string().optional().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY: bool,
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`   ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
