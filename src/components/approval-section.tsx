import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/utils";

type ApprovalAction = { name: string; label: string; tone: "primary" | "outline" | "danger"; requireReason?: boolean; noteLabel?: string; formAction: string };

export function ApprovalSection({
  title,
  status,
  actions,
  actorName,
  actorRole,
  isManager,
}: {
  title: string;
  status: string;
  actions: ApprovalAction[];
  actorName: string;
  actorRole: string | null;
  isManager: boolean;
}) {
  if (actions.length === 0) return null;
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{title}</div>
          <div className="mt-1 text-xs text-slate-500">Acting as <span className="text-white font-semibold">{actorName}</span> · role <span className="font-mono text-cyan-200">{actorRole ?? "—"}</span>{isManager ? " · manager" : " · read-only for approvals"}</div>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {actions.map((a) => (
          <form key={a.name} action={a.formAction} method="post" className="panel p-4 space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{a.label}</div>
            <input
              name={a.requireReason ? "reason" : "note"}
              placeholder={a.requireReason ? "Reason (required, visible to submitter)" : a.noteLabel ?? "Optional note"}
              required={a.requireReason}
              minLength={a.requireReason ? 3 : undefined}
              className="form-input"
            />
            <button className={a.tone === "primary" ? "btn-primary" : a.tone === "danger" ? "btn-danger" : "btn-outline"}>{a.label}</button>
          </form>
        ))}
      </div>
    </section>
  );
}

export function ActivityTrail({
  comments,
  commentAction,
}: {
  comments: Array<{ id: string; authorName: string; kind: string; body: string; createdAt: Date }>;
  commentAction: string;
}) {
  return (
    <section className="card p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Activity · {comments.length}</div>
      <div className="mt-4 space-y-3">
        {comments.length === 0 ? <div className="text-sm text-slate-500">No activity yet.</div> : null}
        {comments.map((c) => (
          <div key={c.id} className="panel p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-white">{c.authorName}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className={kindClass(c.kind)}>{c.kind}</span>
                <span className="text-slate-500">{formatDateTime(c.createdAt)}</span>
              </div>
            </div>
            <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{c.body}</div>
          </div>
        ))}
      </div>
      <form action={commentAction} method="post" className="mt-4 flex gap-2">
        <input name="body" placeholder="Add a comment…" required className="form-input flex-1" />
        <button className="btn-outline">Add</button>
      </form>
    </section>
  );
}

function kindClass(kind: string): string {
  const base = "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ";
  if (kind === "APPROVE") return base + "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (kind === "REJECT") return base + "border-rose-500/30 bg-rose-500/10 text-rose-200";
  if (kind === "SUBMIT") return base + "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  if (kind === "EDIT") return base + "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (kind === "PAY") return base + "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (kind === "RESPOND") return base + "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";
  return base + "border-white/10 bg-white/5 text-slate-300";
}
