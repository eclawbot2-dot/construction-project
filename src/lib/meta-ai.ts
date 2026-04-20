/**
 * Meta AI — test fixtures + release notes.
 */

import { aiCall } from "@/lib/ai";

export type Fixture = { model: string; sample: Record<string, unknown> };

export async function generateFixtures(models: string[]): Promise<Fixture[]> {
  return aiCall<Fixture[]>({
    kind: "fixtures",
    prompt: `Generate fixtures for ${models.join(",")}`,
    fallback: () => {
      return models.map((model) => {
        const base: Record<string, unknown> = { id: `fixture-${model.toLowerCase()}-001` };
        if (model === "Project") Object.assign(base, { code: "P-901", name: "Sample Commercial Build", mode: "VERTICAL", status: "IN_PROGRESS", contractValue: 12_500_000 });
        else if (model === "Opportunity") Object.assign(base, { name: "Sample Municipal Bid", clientName: "City of Anywhere", stage: "PROPOSAL", estimatedValue: 4_800_000, probability: 45, mode: "HEAVY_CIVIL" });
        else if (model === "Vendor") Object.assign(base, { name: "Acme Concrete", trade: "Concrete", prequalStatus: "APPROVED", bondingCapacity: 5_000_000 });
        else if (model === "BidDraft") Object.assign(base, { title: "Sample Bid Draft", overheadPct: 10, profitPct: 8, totalValue: 5_200_000 });
        else if (model === "JournalEntryRow") Object.assign(base, { accountName: "Concrete Supplier", amount: 42_500, vendorName: "Acme Concrete", memo: "May deliveries", reconciliationStatus: "UNREVIEWED" });
        return { model, sample: base };
      });
    },
  });
}

export type ReleaseNotes = { version: string; highlights: string[]; bugs: string[]; breaking: string[] };

export async function releaseNotesFromCommits(commits: Array<{ sha: string; subject: string; body?: string }>): Promise<ReleaseNotes> {
  return aiCall<ReleaseNotes>({
    kind: "release-notes",
    prompt: `Release notes from ${commits.length} commits`,
    fallback: () => {
      const highlights: string[] = [];
      const bugs: string[] = [];
      const breaking: string[] = [];
      for (const c of commits) {
        const s = c.subject;
        if (/^(fix|bug)/i.test(s)) bugs.push(s);
        else if (/breaking|!:/i.test(s) || /BREAKING/.test(c.body ?? "")) breaking.push(s);
        else highlights.push(s);
      }
      return {
        version: `v${new Date().toISOString().slice(0, 10)}`,
        highlights: highlights.slice(0, 12),
        bugs: bugs.slice(0, 8),
        breaking: breaking.slice(0, 5),
      };
    },
  });
}
