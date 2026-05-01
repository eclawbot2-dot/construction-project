import Link from "next/link";
import { Bell, Bot, Building2, BriefcaseBusiness, ClipboardList, Coins, Crown, FileStack, Gauge, Gavel, HardHat, LayoutDashboard, Mail, Search, ShieldAlert, ShieldCheck, Timer, Truck, Upload, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { requireTenant } from "@/lib/tenant";
import { currentSuperAdmin } from "@/lib/permissions";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "./sign-out-button";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Executive Dashboard", icon: LayoutDashboard },
      { href: "/assistant", label: "AI Assistant", icon: Bot },
      { href: "/alerts", label: "Alerts", icon: Bell },
      { href: "/search", label: "Search", icon: Search },
    ],
  },
  {
    title: "Projects & Field",
    items: [
      { href: "/projects", label: "Projects", icon: Building2 },
      { href: "/operations", label: "Operations", icon: HardHat },
      { href: "/safety", label: "Safety Dashboard", icon: ShieldAlert },
      { href: "/permits", label: "Permits watch", icon: ShieldCheck },
      { href: "/workflows", label: "Workflow Center", icon: ClipboardList },
    ],
  },
  {
    title: "Business Development",
    items: [
      { href: "/bids", label: "Bid Hub", icon: Gavel },
      { href: "/bids/discover", label: "Discover RFP sources", icon: Search },
      { href: "/crm", label: "CRM & Shared Services", icon: BriefcaseBusiness },
      { href: "/portal", label: "Owner Portal", icon: Users },
    ],
  },
  {
    title: "Finance & Commercial",
    items: [
      { href: "/finance", label: "CFO · Finance", icon: Coins },
      { href: "/finance/ai", label: "Finance AI", icon: Bot },
      { href: "/finance/inbox", label: "Invoice inbox", icon: Mail },
      { href: "/commercial", label: "Commercial Controls", icon: Gauge },
      { href: "/imports", label: "Historical imports", icon: Upload },
    ],
  },
  {
    title: "Employees & Resources",
    items: [
      { href: "/people", label: "People & Roles", icon: Users },
      { href: "/timesheets", label: "Timesheets", icon: Timer },
      { href: "/vendors", label: "Vendors & Prequal", icon: Truck },
      { href: "/documents", label: "Documents", icon: FileStack },
      { href: "/operations/ai", label: "Ops AI", icon: Bot },
    ],
  },
  {
    title: "Admin & Risk",
    items: [
      { href: "/risk", label: "Risk & Compliance", icon: ShieldAlert },
      { href: "/audit", label: "Audit Trail", icon: ShieldCheck },
    ],
  },
];

export async function Sidebar() {
  const session = await auth();
  const data = await getDashboardData();
  const tenant = await requireTenant().catch(() => null);
  const alertCount = tenant ? await prisma.alertEvent.count({ where: { tenantId: tenant.id, acknowledgedAt: null } }) : 0;
  const superAdmin = await currentSuperAdmin();
  const sessionUser = session?.userId
    ? await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, email: true } })
    : null;

  return (
    <aside className="w-full border-r lg:w-72 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto" style={{ borderColor: "var(--border)", background: "var(--sidebar-bg)" }}>
      <div className="border-b px-5 py-5" style={{ borderColor: "var(--border)" }}>
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-300">Construction OS</div>
        <div className="mt-2 text-xl font-semibold" style={{ color: "var(--heading)" }}>{data?.tenant.name ?? "Platform"}</div>
        <div className="mt-1 text-sm" style={{ color: "var(--faint)" }}>Multi-tenant OS for Simple, Vertical, and Heavy Civil workflows.</div>
      </div>

      {superAdmin ? (
        <Link href="/admin" className="super-admin-pill">
          <Crown className="h-4 w-4" />
          <span className="flex-1">Super Admin</span>
        </Link>
      ) : null}

      <nav className="px-3 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--heading)" }}>{group.title}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge = item.href === "/alerts" && alertCount > 0 ? alertCount : null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition hover:bg-white/5"
                    style={{ color: "var(--body)" }}
                  >
                    <Icon className="h-4 w-4 text-cyan-300" />
                    <span className="flex-1">{item.label}</span>
                    {badge ? <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">{badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t px-5 py-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--faint)" }}>
        <div>Primary mode: <span className="font-medium" style={{ color: "var(--heading)" }}>{data?.tenant.primaryMode.replaceAll("_", " ")}</span></div>
        <div className="mt-2">Feature packs: <span className="font-medium" style={{ color: "var(--heading)" }}>{data?.tenant.featurePacks.length ?? 0}</span></div>
        <div className="mt-2">Business units: <span className="font-medium" style={{ color: "var(--heading)" }}>{data?.tenant.businessUnits.length ?? 0}</span></div>
        {sessionUser ? (
          <div className="mt-4 rounded-lg p-2.5" style={{ background: "var(--hover-bg)" }}>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--faint)" }}>Signed in as</div>
            <div className="mt-0.5 truncate text-sm font-medium" style={{ color: "var(--heading)" }}>{sessionUser.name}</div>
            <div className="truncate text-[11px]" style={{ color: "var(--faint)" }}>{sessionUser.email}</div>
          </div>
        ) : null}
        <div className="mt-3"><ThemeToggle className="w-full justify-center" /></div>
        {sessionUser ? <div className="mt-2"><SignOutButton /></div> : null}
      </div>
    </aside>
  );
}
