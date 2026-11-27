import type { Request } from 'express';
import { prisma } from '../db.ts';
import { logger } from './logger.ts';

export async function audit(req: Request, action: string, entityType: string, entityId?: string | null, data?: unknown) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.session?.user.id,
        actorEmail: req.session?.user.email,
        action,
        entityType,
        entityId: entityId ?? null,
        data: data === undefined ? undefined : (JSON.parse(JSON.stringify(data)) as any),
        ipAddress: req.ip,
      },
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to write audit log');
  }
}
