import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { draftCollectionsEmail } from "@/lib/finance-ai";

export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ payee?: string; amount?: string; days?: string; invNo?: string }> }) {
  const sp = await searchParams;
  const email = sp.payee && sp.amount && sp.days ? await draftCollectionsEmail({
    payeeName: sp.payee,
    invoiceAmount: parseFloat(sp.amount),
    daysPastDue: parseInt(sp.days, 10),
    invoiceNo: sp.invNo ?? "INV-UNKNOWN",
  }) : null;

  return (
    <AppLayout eyebrow="Finance AI" title="AR collections drafter" description="Tiered dunning emails auto-escalate at 30 / 60 / 90 days past due.">
      <form method="get" className="card p-6 grid gap-3 md:grid-cols-4">
        <input name="payee" defaultValue={sp.payee ?? ""} placeholder="Customer name" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
        <input name="invNo" defaultValue={sp.invNo ?? ""} placeholder="Invoice #" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
        <input name="amount" defaultValue={sp.amount ?? ""} type="number" placeholder="Amount past due" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
        <input name="days" defaultValue={sp.days ?? ""} type="number" placeholder="Days past due" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
        <div className="md:col-span-4 flex gap-3">
          <button type="submit" className="btn-primary">Draft email</button>
          <Link href="/finance/ai" className="btn-outline text-xs">← back</Link>
        </div>
      </form>
      {email ? (
        <section className="card p-6 mt-6">
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Tier · {email.tier}</div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mt-4">Subject</div>
          <div className="text-lg font-semibold text-white mt-1">{email.subject}</div>
          <div className="text-xs uppercase tracking-[0.18em] text-slate-500 mt-4">Body</div>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-200 font-sans leading-6">{email.body}</pre>
        </section>
      ) : null}
    </AppLayout>
  );
}
