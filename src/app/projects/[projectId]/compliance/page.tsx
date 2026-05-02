import { notFound } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";
import { formatDate } from "@/lib/utils";

/**
 * Per-project compliance reference. Shows which company-level
 * licenses, COIs, bonds, and certifications cover this job. Lets the
 * PM verify that everything the contract requires is on file before
 * mobilization.
 */
export default async function ProjectCompliancePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const tenant = await requireTenant();
  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: tenant.id } });
  if (!project) notFound();

  const [
    links,
    allLicenses,
    allInsurance,
    allBonds,
    allCertifications,
    bondsForThisProject,
  ] = await Promise.all([
    prisma.projectComplianceLink.findMany({
      where: { projectId },
      include: { companyLicense: true, companyInsurance: true, companyBond: true, companyCertification: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.companyLicense.findMany({ where: { tenantId: tenant.id, status: "ACTIVE" }, orderBy: { licenseType: "asc" } }),
    prisma.companyInsurance.findMany({ where: { tenantId: tenant.id, status: "ACTIVE" }, orderBy: { policyType: "asc" } }),
    prisma.companyBond.findMany({ where: { tenantId: tenant.id, status: "ACTIVE" }, orderBy: { bondType: "asc" } }),
    prisma.companyCertification.findMany({ where: { tenantId: tenant.id, status: "ACTIVE" }, orderBy: { certificationType: "asc" } }),
    prisma.companyBond.findMany({ where: { tenantId: tenant.id, projectId } }),
  ]);

  const linksByType = (type: string) => links.filter((l) => l.requirementType === type);

  return (
    <AppLayout
      eyebrow={`${project.name} · Compliance`}
      title="Project compliance"
      description="Which of the company's licenses, insurance, bonds, and certifications cover this job. Add a requirement + link the matching company record."
    >
      <div className="grid gap-6">
        <section className="card p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Master compliance repository</div>
              <p className="mt-1 text-xs text-slate-400">Manage all company-level records at <Link href="/settings/company" className="text-cyan-300 hover:underline">/settings/company</Link>.</p>
            </div>
            <Link href={`/projects/${projectId}`} className="btn-outline text-xs">← Project</Link>
          </div>
        </section>

        <RequirementBlock
          title="Licenses"
          type="LICENSE"
          links={linksByType("LICENSE")}
          options={allLicenses.map((l) => ({ id: l.id, label: `${l.licenseType} — ${l.licenseNumber}${l.state ? ` (${l.state})` : ""}` }))}
          createPath={`/api/projects/${projectId}/compliance/link`}
          fkField="companyLicenseId"
          renderLinked={(l) => l.companyLicense ? `${l.companyLicense.licenseType} · ${l.companyLicense.licenseNumber}${l.companyLicense.state ? ` (${l.companyLicense.state})` : ""}` : "(not linked)"}
          renderExpiry={(l) => l.companyLicense?.expiresAt ?? null}
        />

        <RequirementBlock
          title="Insurance"
          type="INSURANCE"
          links={linksByType("INSURANCE")}
          options={allInsurance.map((i) => ({ id: i.id, label: `${i.policyType} — ${i.carrier} #${i.policyNumber}` }))}
          createPath={`/api/projects/${projectId}/compliance/link`}
          fkField="companyInsuranceId"
          renderLinked={(l) => l.companyInsurance ? `${l.companyInsurance.policyType} · ${l.companyInsurance.carrier} · #${l.companyInsurance.policyNumber}` : "(not linked)"}
          renderExpiry={(l) => l.companyInsurance?.expiresAt ?? null}
        />

        <RequirementBlock
          title="Bonds"
          type="BOND"
          links={linksByType("BOND")}
          options={allBonds.map((b) => ({ id: b.id, label: `${b.bondType} — ${b.surety}${b.bondNumber ? ` #${b.bondNumber}` : " (capacity)"}` }))}
          createPath={`/api/projects/${projectId}/compliance/link`}
          fkField="companyBondId"
          renderLinked={(l) => l.companyBond ? `${l.companyBond.bondType} · ${l.companyBond.surety}${l.companyBond.bondNumber ? ` · #${l.companyBond.bondNumber}` : ""}` : "(not linked)"}
          renderExpiry={(l) => l.companyBond?.expiresAt ?? null}
        />
        {bondsForThisProject.length > 0 ? (
          <div className="card p-5 border-emerald-500/30 bg-emerald-500/5">
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Project-specific bonds</div>
            <ul className="mt-2 space-y-1 text-sm">
              {bondsForThisProject.map((b) => (
                <li key={b.id}>{b.bondType} — {b.surety}{b.bondNumber ? ` #${b.bondNumber}` : ""}{b.expiresAt ? ` · expires ${formatDate(b.expiresAt)}` : ""}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <RequirementBlock
          title="Certifications"
          type="CERTIFICATION"
          links={linksByType("CERTIFICATION")}
          options={allCertifications.map((c) => ({ id: c.id, label: `${c.certificationType} — ${c.certifyingAgency}${c.certificateNumber ? ` #${c.certificateNumber}` : ""}` }))}
          createPath={`/api/projects/${projectId}/compliance/link`}
          fkField="companyCertificationId"
          renderLinked={(l) => l.companyCertification ? `${l.companyCertification.certificationType} · ${l.companyCertification.certifyingAgency}` : "(not linked)"}
          renderExpiry={(l) => l.companyCertification?.expiresAt ?? null}
        />
      </div>
    </AppLayout>
  );
}

type LinkWithRefs = {
  id: string;
  requirementType: string;
  requirementText: string | null;
  notes: string | null;
  satisfied: boolean;
  companyLicense: { licenseType: string; licenseNumber: string; state: string | null; expiresAt: Date | null } | null;
  companyInsurance: { policyType: string; carrier: string; policyNumber: string; expiresAt: Date } | null;
  companyBond: { bondType: string; surety: string; bondNumber: string | null; expiresAt: Date | null } | null;
  companyCertification: { certificationType: string; certifyingAgency: string; expiresAt: Date | null } | null;
};

function RequirementBlock({ title, type, links, options, createPath, fkField, renderLinked, renderExpiry }: {
  title: string;
  type: string;
  links: LinkWithRefs[];
  options: { id: string; label: string }[];
  createPath: string;
  fkField: string;
  renderLinked: (l: LinkWithRefs) => string;
  renderExpiry: (l: LinkWithRefs) => Date | null | undefined;
}) {
  const soon = new Date();
  soon.setDate(soon.getDate() + 60);
  return (
    <section className="card p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">{title}</div>
      <form action={createPath} method="post" className="mt-3 grid gap-2 md:grid-cols-[2fr_2fr_auto]">
        <input type="hidden" name="requirementType" value={type} />
        <input name="requirementText" placeholder={`${title} requirement (from contract spec)`} className="form-input" />
        <select name={fkField} className="form-select">
          <option value="">— pick a company record —</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button className="btn-primary text-xs">Add link</button>
      </form>
      <ul className="mt-3 divide-y divide-white/5">
        {links.map((l) => {
          const exp = renderExpiry(l);
          const expSoon = exp && exp < soon;
          return (
            <li key={l.id} className="py-2 flex items-center justify-between text-sm">
              <div>
                <div className="text-white">{l.requirementText ?? `${title} requirement`}</div>
                <div className="text-xs text-slate-400">→ {renderLinked(l)}</div>
                {l.notes ? <div className="text-xs text-slate-500">{l.notes}</div> : null}
              </div>
              <div className="text-right text-xs">
                {exp ? <div className={expSoon ? "text-amber-300" : "text-slate-400"}>expires {formatDate(exp)}{expSoon ? " ⚠" : ""}</div> : null}
                <div className={l.satisfied ? "text-emerald-300" : "text-slate-500"}>{l.satisfied ? "✓ verified" : "unverified"}</div>
              </div>
            </li>
          );
        })}
        {links.length === 0 ? <li className="py-3 text-center text-xs text-slate-500">No {title.toLowerCase()} requirements linked yet.</li> : null}
      </ul>
    </section>
  );
}
