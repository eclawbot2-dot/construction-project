"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Cross,
  Calendar,
  Megaphone,
  BarChart3,
  Settings,
  BookMarked,
  Heart,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "DIRECTOR", "PARENT"] },
  { href: "/students", label: "Students", icon: GraduationCap, roles: ["ADMIN", "DIRECTOR"] },
  { href: "/catechists", label: "Catechists", icon: Users, roles: ["ADMIN", "DIRECTOR"] },
  { href: "/classes", label: "My Class", icon: BookOpen, roles: ["CATECHIST"] },
  { href: "/classes", label: "Classes", icon: BookOpen, roles: ["ADMIN", "DIRECTOR"] },
  { href: "/attendance", label: "Attendance", icon: ClipboardCheck, roles: ["ADMIN", "DIRECTOR", "CATECHIST"] },
  { href: "/sacraments", label: "Sacraments", icon: Cross, roles: ["ADMIN", "DIRECTOR"] },
  { href: "/curriculum", label: "Curriculum", icon: BookMarked, roles: ["ADMIN", "DIRECTOR"] },
  { href: "/service-hours", label: "Service Hours", icon: Heart, roles: ["ADMIN", "DIRECTOR"] },
  { href: "/calendar", label: "Calendar", icon: Calendar, roles: ["ADMIN", "DIRECTOR", "PARENT"] },
  { href: "/announcements", label: "Announcements", icon: Megaphone, roles: ["ADMIN", "DIRECTOR"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "DIRECTOR"] },
  { href: "/admin", label: "Admin Panel", icon: Settings, roles: ["ADMIN"] },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "PARENT";

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <div className="flex flex-col bg-[#1e3a5f] text-white w-64 min-h-screen">
      {/* Logo + close button */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#c9a227] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">HF</span>
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">Holy Face</div>
            <div className="text-xs text-blue-200 leading-tight">Faith Formation</div>
          </div>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-[#c9a227] text-white font-medium"
                  : "text-blue-100 hover:bg-white/10"
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User info at bottom */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="text-xs text-blue-200 truncate">{session?.user?.name}</div>
        <div className="text-[10px] text-blue-300/60 truncate">{session?.user?.email}</div>
      </div>
    </div>
  );
}
