/** Who did something in the admin, as stored on order / reservation timeline events. */
export interface EventActor {
  actorId: string | null;
  actorName: string | null;
}

/**
 * Picks only the columns OrderEvent / ReservationEvent have. `actor(req)` also carries the e-mail (for the audit
 * log), and spreading it straight into a Prisma `create` fails at runtime with "Unknown argument `actorEmail`" —
 * TypeScript doesn't catch extra properties passed through a variable.
 */
export const eventActor = (a?: EventActor | null): Partial<EventActor> => (a ? { actorId: a.actorId, actorName: a.actorName } : {});
