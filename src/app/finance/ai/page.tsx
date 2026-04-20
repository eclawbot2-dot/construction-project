import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";

export default async function FinanceAiHub() {
  return (
    <AppLayout eyebrow="Finance · AI" title="Finance AI toolkit" description="Seven AI helpers for AP automation, anomaly detection, forecasting, variance analysis, and month-end close.">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Tile href="/finance/ai/invoice-extract" title="Invoice extractor" body="Paste a PDF or email; AI extracts vendor, amount, PO, lines." />
        <Tile href="/finance/ai/batch-reclass" title="Batch reclassify" body="Review unreconciled journal rows; AI suggests project + cost code." />
        <Tile href="/finance/ai/anomalies" title="Anomaly detector" body="Duplicates, round-number invoices, high-value entries." />
        <Tile href="/finance/ai/collections" title="AR collections drafter" body="Tiered dunning emails — 30 / 60 / 90 day escalation." />
        <Tile href="/finance/ai/close-checklist" title="Month-end close assistant" body="Auto-tick checklist based on sync state, AP aging, accrual posting." />
        <Tile href="/finance/ai/variance" title="Variance narrator" body="Plain-English explanations of cost-code over/under budget." />
        <Tile href="/finance/ai/eac" title="EAC forecaster" body="Forward-looking project cost & margin based on commitments + burn rate." />
      </div>
    </AppLayout>
  );
}

function Tile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link href={href} className="card p-6 transition hover:border-cyan-500/50">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">AI</div>
      <div className="mt-2 text-lg font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm text-slate-400">{body}</p>
    </Link>
  );
}
