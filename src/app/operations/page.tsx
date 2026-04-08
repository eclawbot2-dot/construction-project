import { AppLayout } from "@/components/layout/app-layout";
import { getDashboardData } from "@/lib/dashboard";
import { modeLabel } from "@/lib/utils";

export default async function OperationsPage() {
  const data = await getDashboardData();
  const heavyCivil = data?.projectWorkspaces.filter((project) => project.mode === "HEAVY_CIVIL") ?? [];
  const vertical = data?.projectWorkspaces.filter((project) => project.mode === "VERTICAL") ?? [];

  return (
    <AppLayout
      eyebrow="Pass 4 — Vertical and heavy-civil depth"
      title="Operations"
      description="Operational execution views for field production, quantities, RFIs, submittals, equipment, materials, and project control rituals across the mode packs."
    >
      <div className="grid gap-6">
        <section className="grid gap-6 xl:grid-cols-2">
          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Heavy civil execution</div>
            <div className="mt-4 space-y-4">
              {heavyCivil.map((project) => (
                <div key={project.id} className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                  <div className="font-medium text-white">{project.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-amber-200">{modeLabel(project.mode)}</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {project.quantityHighlights.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                        <div className="font-medium text-white">{item.description}</div>
                        <div className="mt-1">Installed {item.installedQty} / {item.budgetQty} {item.unit}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.locationTag}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {project.productionHighlights.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                        <div className="font-medium text-white">{item.activity}</div>
                        <div className="mt-1">Crew: {item.crewName}</div>
                        <div className="mt-1">Rate: {item.productionRate}/hr</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {project.equipmentRecords.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                        <div className="font-medium text-white">{item.equipmentCode}</div>
                        <div className="mt-1">{item.description}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.ownershipType} · {item.assignedCrew}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {project.materialRecords.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                        <div className="font-medium text-white">{item.materialType}</div>
                        <div className="mt-1">{item.quantity} {item.unit}</div>
                        <div className="mt-1 text-xs text-slate-400">{item.status} · {item.locationTag}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Vertical technical workflow coverage</div>
            <div className="mt-4 space-y-4">
              {vertical.map((project) => (
                <div key={project.id} className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                  <div className="font-medium text-white">{project.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-cyan-200">{modeLabel(project.mode)}</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-sm font-medium text-white">RFIs</div>
                      <div className="mt-2 space-y-2 text-sm text-slate-300">
                        {project.rfis.map((rfi) => <div key={rfi.id}>{rfi.number} · {rfi.subject}</div>)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-sm font-medium text-white">Submittals</div>
                      <div className="mt-2 space-y-2 text-sm text-slate-300">
                        {project.submittals.map((submittal) => <div key={submittal.id}>{submittal.number} · {submittal.title}</div>)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                    Drawings/spec management, meetings, document control, procurement risk, and approval routing are now surfaced together as one technical workflow zone.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
