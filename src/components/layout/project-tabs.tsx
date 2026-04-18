import Link from "next/link";

export const PROJECT_TABS = [
  { slug: "", label: "Overview" },
  { slug: "schedule", label: "Schedule" },
  { slug: "tasks", label: "Tasks" },
  { slug: "daily-logs", label: "Daily Logs" },
  { slug: "rfis", label: "RFIs" },
  { slug: "submittals", label: "Submittals" },
  { slug: "change-orders", label: "Change Orders" },
  { slug: "contracts", label: "Contracts" },
  { slug: "bids", label: "Bids" },
  { slug: "pay-apps", label: "Pay Apps" },
  { slug: "sub-invoices", label: "Sub Invoices" },
  { slug: "lien-waivers", label: "Lien Waivers" },
  { slug: "purchase-orders", label: "POs" },
  { slug: "timesheets", label: "Timesheets" },
  { slug: "inspections", label: "Inspections" },
  { slug: "safety", label: "Safety" },
  { slug: "punch-list", label: "Punch List" },
  { slug: "warranty", label: "Warranty" },
  { slug: "documents", label: "Documents" },
] as const;

export function ProjectTabs({ projectId, active }: { projectId: string; active: string }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-2 text-sm">
        {PROJECT_TABS.map((tab) => {
          const href = tab.slug ? `/projects/${projectId}/${tab.slug}` : `/projects/${projectId}`;
          const isActive = active === (tab.slug || "overview");
          return (
            <Link
              key={tab.slug || "overview"}
              href={href}
              className={
                "rounded-full px-3 py-1.5 font-medium whitespace-nowrap transition " +
                (isActive ? "bg-cyan-500/20 text-cyan-100 border border-cyan-500/40" : "text-slate-400 hover:bg-white/5 hover:text-white")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
