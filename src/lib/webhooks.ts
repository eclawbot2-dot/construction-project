/**
 * Outbound webhook delivery. When a domain event fires (rfi.created,
 * payapp.approved, listing.scored), call dispatchWebhook(tenantId,
 * eventType, payload). The function looks up active endpoints
 * subscribed to the event type and POSTs the payload with HMAC
 * signature.
 *
 * Failures are logged to WebhookDelivery; the endpoint's failureCount
 * increments. Retry is left to the caller / cron — this function is
 * fire-and-forget for the common case.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/log";

export async function dispatchWebhook(tenantId: string, eventType: string, payload: unknown): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { tenantId, active: true },
  });
  const matching = endpoints.filter((e) => {
    let events: string[] = [];
    try { events = JSON.parse(e.eventsJson); } catch { /* fall through */ }
    return events.includes("*") || events.includes(eventType);
  });
  if (matching.length === 0) return;

  const body = JSON.stringify({
    event: eventType,
    occurredAt: new Date().toISOString(),
    tenantId,
    data: payload,
  });

  await Promise.all(matching.map((endpoint) => deliverOne(endpoint, eventType, body)));
}

async function deliverOne(endpoint: { id: string; url: string; secret: string }, eventType: string, body: string) {
  const start = Date.now();
  const signature = crypto.createHmac("sha256", endpoint.secret).update(body).digest("hex");
  let responseCode: number | null = null;
  let responseBody: string | null = null;
  let succeeded = false;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(endpoint.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-bcon-event": eventType,
        "x-bcon-signature": `sha256=${signature}`,
        "user-agent": "bcon-webhooks/1.0",
      },
      body,
    });
    clearTimeout(timeout);
    responseCode = res.status;
    responseBody = (await res.text()).slice(0, 1000);
    succeeded = res.ok;
  } catch (err) {
    log.warn("webhook delivery failed", { module: "webhooks", endpointId: endpoint.id, eventType }, err);
  }

  const durationMs = Date.now() - start;
  await prisma.webhookDelivery.create({
    data: {
      endpointId: endpoint.id,
      eventType,
      payloadJson: body.slice(0, 8000),
      responseCode,
      responseBody,
      durationMs,
      succeeded,
    },
  });

  await prisma.webhookEndpoint.update({
    where: { id: endpoint.id },
    data: {
      lastDeliveryAt: new Date(),
      lastSuccessAt: succeeded ? new Date() : undefined,
      failureCount: succeeded ? 0 : { increment: 1 },
    },
  });
}
