import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { generateFixtures, releaseNotesFromCommits } from "@/lib/meta-ai";
import { isLlmEnabled } from "@/lib/ai";

const DEFAULT_MODELS = ["Project", "Opportunity", "Vendor", "BidDraft", "JournalEntryRow"];

export default async function MetaAiPage() {
  const fixtures = await generateFixtures(DEFAULT_MODELS);
  const notes = await releaseNotesFromCommits([
    { sha: "abc", subject: "Add QBO connector alongside Xero" },
    { sha: "def", subject: "Add RFP autopilot + scheduled sweep" },
    { sha: "ghi", subject: "Add 45-item AI capability suite" },
    { sha: "jkl", subject: "fix: tenant scoping on projects list" },
  ]);

  return (
    <AppLayout eyebrow="AI · Platform" title="Meta / operational AI" description="Test fixtures, release notes, LLM swap indicator.">
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">LLM status</div>
        <div className="mt-2 text-lg font-semibold text-white">{isLlmEnabled() ? "Claude API enabled" : "Deterministic mocks (flip ENABLE_LLM_CALLS=true + set ANTHROPIC_API_KEY)"}</div>
        <p className="mt-2 text-xs text-slate-500">All 45 AI features share one wrapper in <span className="font-mono">src/lib/ai.ts</span>. When the flag is off, callers get deterministic heuristic output. When on, calls route to Claude.</p>
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Test fixtures</div>
        <pre className="mt-3 overflow-x-auto bg-slate-950 rounded-lg p-4 text-xs text-slate-200">{JSON.stringify(fixtures, null, 2)}</pre>
      </section>
      <section className="card p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Release notes · {notes.version}</div>
        {notes.breaking.length > 0 ? (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-[0.18em] text-rose-300">Breaking</div>
            <ul className="mt-1 text-sm text-slate-200 list-disc pl-5">{notes.breaking.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
        ) : null}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-[0.18em] text-emerald-300">Highlights</div>
          <ul className="mt-1 text-sm text-slate-200 list-disc pl-5">{notes.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </div>
        {notes.bugs.length > 0 ? (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-[0.18em] text-amber-300">Bug fixes</div>
            <ul className="mt-1 text-sm text-slate-200 list-disc pl-5">{notes.bugs.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
        ) : null}
      </section>
      <Link href="/" className="btn-outline text-xs">← home</Link>
    </AppLayout>
  );
}
