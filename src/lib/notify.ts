/**
 * Notification dispatch — pluggable transport.
 *
 * Background (audit Pass 7 §2.2): Watcher / NotificationRule / AlertRule /
 * AlertEvent rows were being created throughout the app, but no SMTP, push,
 * or in-app delivery code existed anywhere. The data model promised
 * notification delivery; the runtime never fulfilled it.
 *
 * This module defines a thin dispatcher with a swappable Transport. The
 * default transport (`ConsoleTransport`) writes a structured record to
 * stderr, which is exactly what we want in dev and CI: every notification
 * is visible without external dependencies, and no real emails leak to
 * customers from a misconfigured environment.
 *
 * To enable real email in production, install Resend (or your provider)
 * and set NOTIFY_TRANSPORT=resend plus RESEND_API_KEY. The provider call
 * lives behind the same `Transport.send` interface — no caller changes.
 *
 * Design choices:
 *   - Dispatch errors never throw. The caller's mutation has already
 *     committed; a flaky email service must not roll back business state.
 *     Errors flow to stderr via console.error.
 *   - Watchers are looked up at dispatch time (not enqueued ahead). The
 *     audit doc plans a real queue (PR #9b: BullMQ/Inngest); this
 *     in-process dispatch is the bridging step until that lands.
 *   - Per-recipient delivery loops sequentially. Acceptable for the
 *     handful of watchers a typical record has; will need batching once
 *     watcher counts exceed ~50 per event.
 */

import { prisma } from "@/lib/prisma";
import { getQueue } from "@/lib/queue";
import type { AlertEvent, Watcher } from "@prisma/client";

export type NotificationPayload = {
  tenantId: string;
  projectId?: string | null;
  subject: string;
  body: string;
  link?: string | null;
  severity?: "INFO" | "WARN" | "CRITICAL";
  entityType?: string | null;
  entityId?: string | null;
};

export type Recipient = {
  userId: string;
  name: string;
  email: string | null;
};

const DELIVER_JOB = "notify.deliver";
let queueRegistered = false;

function registerQueueHandler() {
  if (queueRegistered) return;
  queueRegistered = true;
  getQueue().register<{ recipient: Recipient; payload: NotificationPayload }>(
    DELIVER_JOB,
    async ({ recipient, payload }) => {
      try {
        await activeTransport.send(recipient, payload);
      } catch (err) {
        console.error("[notify] transport.send failed", { recipient: recipient.email ?? recipient.userId, err });
      }
    },
  );
}

export interface Transport {
  name: string;
  send(recipient: Recipient, payload: NotificationPayload): Promise<void>;
}

class ConsoleTransport implements Transport {
  name = "console";
  async send(recipient: Recipient, payload: NotificationPayload): Promise<void> {
    const sev = payload.severity ?? "INFO";
    console.log(
      `[notify:${this.name}] [${sev}] to=${recipient.email ?? recipient.userId} ` +
      `subject=${JSON.stringify(payload.subject)} ` +
      `link=${payload.link ?? "(none)"} ` +
      `body=${JSON.stringify(payload.body)}`,
    );
  }
}

class NoopTransport implements Transport {
  name = "noop";
  async send(): Promise<void> {
    /* intentionally silent */
  }
}

let activeTransport: Transport = new ConsoleTransport();

/**
 * Swap the active transport. Called once at startup by whatever boots the
 * notification subsystem (e.g. a Resend / Postmark adapter when its env
 * vars are present). Tests can call this to install a stub.
 */
export function setNotifyTransport(transport: Transport): void {
  activeTransport = transport;
}

/**
 * Resolve transport from env at module load. Future: detect Resend /
 * Postmark / SES configuration and instantiate the matching adapter.
 */
function bootstrapTransport(): void {
  const choice = (process.env.NOTIFY_TRANSPORT ?? "console").toLowerCase();
  if (choice === "noop") {
    activeTransport = new NoopTransport();
  }
  // "resend" / "postmark" / "ses" wiring goes here once the adapter
  // packages are installed. For now those modes fall through to console.
}

bootstrapTransport();

/**
 * Resolve recipients for a notification. Combines:
 *   - direct project Watchers (with a userId)
 *   - role-targeted memberships from NotificationRules whose trigger
 *     matches the payload's entityType
 * Deduplicates by userId. Skips inactive users.
 */
async function resolveRecipients(payload: NotificationPayload): Promise<Recipient[]> {
  const recipients = new Map<string, Recipient>();

  // Project-level watchers
  if (payload.projectId) {
    const watchers = await prisma.watcher.findMany({
      where: {
        projectId: payload.projectId,
        userId: { not: null },
        ...(payload.entityType ? { objectType: payload.entityType } : {}),
      },
      include: { user: true },
    });
    for (const w of watchers as (Watcher & { user: { id: string; name: string; email: string | null; active: boolean } | null })[]) {
      if (!w.user || !w.user.active) continue;
      recipients.set(w.user.id, { userId: w.user.id, name: w.user.name, email: w.user.email });
    }
  }

  // Tenant-level NotificationRules — pull memberships in the matching role.
  if (payload.entityType) {
    const rules = await prisma.notificationRule.findMany({
      where: { tenantId: payload.tenantId, triggerType: payload.entityType },
    });
    for (const rule of rules) {
      if (!rule.roleTemplate) continue;
      const memberships = await prisma.membership.findMany({
        where: { tenantId: payload.tenantId, roleTemplate: rule.roleTemplate },
        include: { user: true },
      });
      for (const m of memberships) {
        if (!m.user.active) continue;
        if (recipients.has(m.user.id)) continue;
        recipients.set(m.user.id, { userId: m.user.id, name: m.user.name, email: m.user.email });
      }
    }
  }

  return [...recipients.values()];
}

/**
 * Dispatch a notification. Returns the count of recipients that the
 * dispatcher will attempt to reach (the actual transport.send happens
 * on the queue, so callers don't block on slow SMTP). Never throws.
 *
 * With the in-process queue (the dev default) recipients are attempted
 * on the next microtask, identical to inline behaviour. Once a real
 * queue (BullMQ / Inngest) is wired, the same call enqueues a durable
 * job per recipient — slow email providers stop blocking the request
 * thread and a transient SMTP outage retries instead of dropping.
 */
export async function notify(payload: NotificationPayload): Promise<number> {
  try {
    registerQueueHandler();
    const recipients = await resolveRecipients(payload);
    if (recipients.length === 0) return 0;
    const q = getQueue();
    for (const recipient of recipients) {
      await q.enqueue(DELIVER_JOB, { recipient, payload });
    }
    return recipients.length;
  } catch (err) {
    console.error("[notify] resolveRecipients failed", { payload, err });
    return 0;
  }
}

/**
 * Convenience: dispatch a notification for a freshly-created AlertEvent.
 * Called by the alert engine right after `prisma.alertEvent.create(...)`.
 */
export async function notifyForAlert(event: AlertEvent): Promise<number> {
  return notify({
    tenantId: event.tenantId,
    projectId: event.projectId,
    subject: event.title,
    body: event.body ?? "",
    link: event.link,
    severity: (event.severity as "INFO" | "WARN" | "CRITICAL") ?? "INFO",
    entityType: event.entityType,
    entityId: event.entityId,
  });
}
