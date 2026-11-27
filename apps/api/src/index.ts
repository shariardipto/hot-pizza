import { createApp } from './app.ts';
import { prisma } from './db.ts';
import { env } from './env.ts';
import { logger } from './lib/logger.ts';
import { redis } from './lib/rate-limit.ts';
import { expireUnpaidOrders } from './modules/orders/service.ts';
import { configuredProviders } from './modules/payments/registry.ts';
import { applyRetention } from './modules/privacy/service.ts';

const app = createApp();
const server = app.listen(env.API_PORT, () => {
  logger.info(`API listening on http://localhost:${env.API_PORT}`);
  const providers = configuredProviders();
  logger.info(`Payment providers: ${providers.length ? providers.join(', ') : 'none configured (cash on delivery only)'}`);
});

// Background job: cancel unpaid online orders after the configured timeout and restock them.
const job = setInterval(() => {
  expireUnpaidOrders()
    .then((n) => n && logger.info(`Expired ${n} unpaid order(s)`))
    .catch((err) => logger.error({ err }, 'expireUnpaidOrders failed'));
}, 5 * 60_000);
job.unref();

// Background job: privacy retention (Settings → Security). First run shortly after start, then every 6 hours.
const runRetention = () =>
  applyRetention()
    .then((r) => r && (r.orders || r.reservations || r.ipAddresses || r.sessions) && logger.info({ retention: r }, 'Privacy retention applied'))
    .catch((err) => logger.error({ err }, 'applyRetention failed'));
const retentionStart = setTimeout(runRetention, 60_000);
const retentionJob = setInterval(runRetention, 6 * 60 * 60_000);
retentionStart.unref();
retentionJob.unref();

async function shutdown(signal: string) {
  logger.info(`${signal} received — shutting down`);
  clearInterval(job);
  clearTimeout(retentionStart);
  clearInterval(retentionJob);
  server.close(() => undefined);
  await prisma.$disconnect().catch(() => undefined);
  await redis?.quit().catch(() => undefined);
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
