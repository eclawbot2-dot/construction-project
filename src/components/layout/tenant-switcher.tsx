import Link from "next/link";
import { getCurrentTenant, listTenants } from "@/lib/tenant";
import { modeLabel } from "@/lib/utils";

export async function TenantSwitcher() {
  const [current, all] = await Promise.all([getCurrentTenant(), listTenants()]);
  if (!current) return null;

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <form action="/api/tenant/switch" method="post" className="flex items-center gap-2">
        <label className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Tenant</label>
        <select
          name="slug"
          defaultValue={current.slug}
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500"
        >
          {all.map((t) => (
            <option key={t.id} value={t.slug}>{t.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-cyan-500/40">
          Switch
        </button>
      </form>
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
          {modeLabel(current.primaryMode)}
        </span>
        <Link href="/settings" className="text-[10px] uppercase tracking-[0.22em] text-slate-400 underline-offset-2 hover:text-cyan-300 hover:underline">
          Configure modes
        </Link>
      </div>
    </div>
  );
}
