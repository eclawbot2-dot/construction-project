import { NextResponse } from "next/server";

/**
 * Public OpenAPI 3.1 spec for the v1 API. Lists every available
 * endpoint with auth + scopes + response shapes. No auth on this
 * endpoint itself — it's a discovery surface.
 */
export async function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "bcon Construction OS Public API",
      version: "1.0.0",
      description:
        "Public REST API for the bcon construction management platform. " +
        "Token auth via Authorization: Bearer bcon_<prefix>.<secret>. " +
        "Issue tokens at /admin (super-admin) or /settings/api (per-tenant — coming).",
      contact: { email: "api@bcon.jahdev.com" },
    },
    servers: [{ url: "https://bcon.jahdev.com/api/v1" }],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "bcon-token" },
      },
    },
    security: [{ BearerAuth: [] }],
    paths: {
      "/projects": {
        get: {
          summary: "List projects",
          description: "Tenant-scoped project list. Filter by stage, mode.",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
            { name: "stage", in: "query", schema: { type: "string" } },
            { name: "mode", in: "query", schema: { type: "string", enum: ["SIMPLE", "VERTICAL", "HEAVY_CIVIL"] } },
          ],
          responses: { "200": { description: "Project list" } },
          tags: ["Projects"],
          "x-required-scope": "read:projects",
        },
      },
      "/listings": {
        get: {
          summary: "List discovered RFP listings",
          description: "Bid listings discovered by watched sources. Filter by status, min_score, since.",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "min_score", in: "query", schema: { type: "integer", minimum: 0, maximum: 100 } },
            { name: "since", in: "query", schema: { type: "string", format: "date-time" } },
          ],
          responses: { "200": { description: "Listing list" } },
          tags: ["Bids"],
          "x-required-scope": "read:listings",
        },
      },
      "/rfis": {
        get: {
          summary: "List RFIs",
          parameters: [
            { name: "project_id", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
          ],
          responses: { "200": { description: "RFI list" } },
          tags: ["RFIs"],
          "x-required-scope": "read:rfis",
        },
        post: {
          summary: "Create RFI",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["project_id", "number", "subject"],
                  properties: {
                    project_id: { type: "string" },
                    number: { type: "string" },
                    subject: { type: "string" },
                    question: { type: "string" },
                    due_date: { type: "string", format: "date-time" },
                    ball_in_court: { type: "string" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Created RFI" } },
          tags: ["RFIs"],
          "x-required-scope": "write:rfis",
        },
      },
    },
    "x-webhooks": {
      "rfi.created": { summary: "Fired when an RFI is created via API" },
      "payapp.approved": { summary: "Fired when a pay application is approved" },
      "listing.scored": { summary: "Fired when a new RFP listing is scored" },
    },
  };
  return NextResponse.json(spec, { headers: { "cache-control": "public, max-age=300" } });
}
