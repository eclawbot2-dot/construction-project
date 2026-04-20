import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";

export default async function OpsAiHub() {
  return (
    <AppLayout eyebrow="Operations · AI" title="Ops & HR AI toolkit" description="Resume matching, timesheet anomalies, crew assignment, cert gaps, retention risk.">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Tile href="/operations/ai/resume-match" title="Resume → Role match" body="Paste resume text; AI extracts skills, scores role fit, flags missing certs." />
        <Tile href="/operations/ai/timesheet-anomalies" title="Timesheet anomaly detector" body="Impossible hours, multi-project splits, data-entry errors." />
        <Tile href="/operations/ai/crew-optimize" title="Crew assignment optimizer" body="Suggest best crew for each schedule task with confidence." />
        <Tile href="/operations/ai/cert-gaps" title="Cert gap detector" body="Staff missing OSHA 30, CPR, PMP required for assigned duties." />
        <Tile href="/operations/ai/turnover" title="Turnover predictor" body="At-risk staff signal + retention action recommendation." />
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
