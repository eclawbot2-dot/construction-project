"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardCheck,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";

const bottomItemsByRole: Record<string, Array<{ href: string; label: string; icon: any }>> = {
  CATECHIST: [
    { href: "/classes", label: "My Class", icon: BookOpen },
    { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
  ],
  DEFAULT: [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/students", label: "Students", icon: GraduationCap },
    { href: "/attendance", label: "Attendance", icon: ClipboardCheck },
    { href: "/classes", label: "Classes", icon: BookOpen },
  ],
};

export function BottomNav({ onMorePress }: { onMorePress?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string })?.role ?? "PARENT";

  const items = bottomItemsByRole[role] || bottomItemsByRole.DEFAULT;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-bottom">
      <div className="flex items-center justify-around px-1 py-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg min-w-[60px] transition-colors relative",
                active ? "text-[#1e3a5f]" : "text-gray-400"
              )}
            >
              <Icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
              <span className={cn("text-[10px]", active ? "font-semibold" : "font-medium")}>
                {item.label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-[#c9a227] rounded-full" />
              )}
            </Link>
          );
        })}
        {role !== "CATECHIST" && (
          <button
            onClick={onMorePress}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg min-w-[60px] text-gray-400"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        )}
      </div>
    </nav>
  );
}
