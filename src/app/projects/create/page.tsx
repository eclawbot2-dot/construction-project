import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { ProjectMode } from "@prisma/client";

const MODE_DESCRIPTIONS: Record<ProjectMode, string> = {
  SIMPLE: "Simple Construction PM — remodels, custom homes, single-trade GCs.",
  VERTICAL: "Vertical Building — commercial, multifamily, institutional.",
  HEAVY_CIVIL: "Heavy Civil — utilities, roadway, earthwork.",
};

export default async function NewProjectPage() {
  const tenant = await requireTenant();
  const businessUnits = await prisma.businessUnit.findMany({
    where: { tenantId: tenant.id },
    orderBy: { name: "asc" },
  });

  return (
    <AppLayout
      eyebrow={tenant.name}
      title="New project"
      description="Create the project record. Mode selection drives which tabs and forms light up. You can edit everything later from the project workspace."
    >
      <div className="grid gap-6">
        <section className="card p-6">
          <form action="/api/projects/create" method="post" className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="proj-name" className="form-label">Project name</label>
                <input id="proj-name" name="name" required placeholder="e.g. Charleston Mixed-Use" className="form-input" />
              </div>
              <div>
                <label htmlFor="proj-code" className="form-label">Project code</label>
                <input id="proj-code" name="code" required pattern="[A-Za-z0-9-]+" placeholder="CMU-001" className="form-input font-mono" />
                <p className="mt-1 text-xs" style={{ color: "var(--faint)" }}>Letters, digits, dashes only. Used in URLs and filenames.</p>
              </div>
            </div>

            <div>
              <label htmlFor="proj-mode" className="form-label">Mode</label>
              <select id="proj-mode" name="mode" defaultValue={tenant.primaryMode} className="form-select" required>
                {(["SIMPLE", "VERTICAL", "HEAVY_CIVIL"] as ProjectMode[]).map((m) => (
                  <option key={m} value={m}>{m.replace("_", " ")} — {MODE_DESCRIPTIONS[m]}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="proj-bu" className="form-label">Business unit</label>
                <select id="proj-bu" name="businessUnitId" defaultValue="" className="form-select">
                  <option value="">— none —</option>
                  {businessUnits.map((bu) => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="proj-owner" className="form-label">Owner / client</label>
                <input id="proj-owner" name="ownerName" placeholder="Charleston Retail LLC" className="form-input" />
              </div>
            </div>

            <div>
              <label htmlFor="proj-addr" className="form-label">Address</label>
              <input id="proj-addr" name="address" placeholder="123 Main St, Charleston, SC" className="form-input" />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label htmlFor="proj-ct" className="form-label">Contract type</label>
                <input id="proj-ct" name="contractType" placeholder="GMP / Lump Sum / Cost Plus" className="form-input" />
              </div>
              <div>
                <label htmlFor="proj-cv" className="form-label">Contract value ($)</label>
                <input id="proj-cv" name="contractValue" type="number" step="1000" min={0} className="form-input" />
              </div>
              <div>
                <label htmlFor="proj-mt" className="form-label">Target margin (%)</label>
                <input id="proj-mt" name="marginTargetPct" type="number" step="0.5" min={0} max={100} className="form-input" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" className="btn-primary">Create project</button>
              <Link href="/projects" className="btn-outline">Cancel</Link>
            </div>
          </form>
        </section>
      </div>
    </AppLayout>
  );
}
