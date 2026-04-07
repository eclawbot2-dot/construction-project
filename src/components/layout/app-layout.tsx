"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BottomNav } from "./bottom-nav";
import { useState } from "react";

export function AppLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, shown via hamburger or "More" */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:static lg:z-auto transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header title={title} onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        {/* Main content — extra bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav onMorePress={() => setSidebarOpen(true)} />
    </div>
  );
}
