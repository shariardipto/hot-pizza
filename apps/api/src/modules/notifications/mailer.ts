import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../env.ts';
import { logger } from '../../lib/logger.ts';

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/** Sends an e-mail. Never throws — failures are logged so they can't break checkout or bookings. */
export async function sendMail(mail: Mail): Promise<boolean> {
  const t = getTransport();
  if (!t) {
    logger.info({ to: mail.to, subject: mail.subject }, `✉️  (SMTP not configured — e-mail logged)\n${mail.text}`);
    return false;
  }
  try {
    await t.sendMail({ from: env.MAIL_FROM, ...mail });
    return true;
  } catch (err) {
    logger.error({ err, to: mail.to, subject: mail.subject }, 'Failed to send e-mail');
    return false;
  }
}
