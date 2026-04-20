import Link from "next/link";
import { Bell, Bot, Building2, BriefcaseBusiness, ClipboardList, Coins, FileStack, Gauge, Gavel, HardHat, LayoutDashboard, Mail, Search, ShieldAlert, ShieldCheck, Timer, Truck, Upload, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboard";
import { requireTenant } from "@/lib/tenant";

const navItems = [
  { href: "/", label: "Executive Dashboard", icon: LayoutDashboard },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/search", label: "Search", icon: Search },
  { href: "/projects", label: "Projects", icon: Building2 },
  { href: "/bids", label: "Bid Hub", icon: Gavel },
  { href: "/bids/discover", label: "Discover RFP sources", icon: Search },
  { href: "/vendors", label: "Vendors & Prequal", icon: Truck },
  { href: "/workflows", label: "Workflow Center", icon: ClipboardList },
  { href: "/timesheets", label: "Timesheets", icon: Timer },
  { href: "/documents", label: "Documents", icon: FileStack },
  { href: "/imports", label: "Historical imports", icon: Upload },
  { href: "/operations", label: "Operations", icon: HardHat },
  { href: "/commercial", label: "Commercial Controls", icon: Gauge },
  { href: "/finance", label: "CFO · Finance", icon: Coins },
  { href: "/finance/ai", label: "Finance AI", icon: Bot },
  { href: "/finance/inbox", label: "Invoice inbox", icon: Mail },
  { href: "/permits", label: "Permits watch", icon: ShieldCheck },
  { href: "/safety", label: "Safety Dashboard", icon: ShieldAlert },
  { href: "/risk", label: "Risk & Compliance", icon: ShieldAlert },
  { href: "/crm", label: "CRM & Shared Services", icon: BriefcaseBusiness },
  { href: "/portal", label: "Owner Portal", icon: Users },
  { href: "/people", label: "People & Roles", icon: Users },
  { href: "/operations/ai", label: "Ops AI", icon: Bot },
  { href: "/audit", label: "Audit Trail", icon: ShieldCheck },
];

export async function Sidebar() {
  const data = await getDashboardData();
  const tenant = await requireTenant().catch(() => null);
  const alertCount = tenant ? await prisma.alertEvent.count({ where: { tenantId: tenant.id, acknowledgedAt: null } }) : 0;

  return (
    <aside className="w-full border-r border-white/10 bg-slate-950/90 lg:w-72">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Construction OS</div>
        <div className="mt-2 text-xl font-semibold text-white">{data?.tenant.name ?? "Platform"}</div>
        <div className="mt-1 text-sm text-slate-400">Multi-tenant operating system for Simple, Vertical, and Heavy Civil workflows.</div>
      </div>

      <nav className="space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const badge = item.href === "/alerts" && alertCount > 0 ? alertCount : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              <Icon className="h-5 w-5 text-cyan-300" />
              <span className="flex-1">{item.label}</span>
              {badge ? <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">{badge}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4 text-sm text-slate-400">
        <div>Primary mode: <span className="font-medium text-white">{data?.tenant.primaryMode.replaceAll("_", " ")}</span></div>
        <div className="mt-2">Feature packs: <span className="font-medium text-white">{data?.tenant.featurePacks.length ?? 0}</span></div>
        <div className="mt-2">Business units: <span className="font-medium text-white">{data?.tenant.businessUnits.length ?? 0}</span></div>
      </div>
    </aside>
  );
}
