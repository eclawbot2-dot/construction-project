"use client";

import { useSession, signOut } from "next-auth/react";
import { roleLabel } from "@/lib/utils";
import { Bell, LogOut, User, ChevronDown, Menu, KeyRound } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";

export function Header({
  title,
  onMenuToggle,
}: {
  title?: string;
  onMenuToggle?: () => void;
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpForm, setCpForm] = useState({ current: "", next: "", confirm: "" });
  const [cpError, setCpError] = useState("");
  const [cpSuccess, setCpSuccess] = useState(false);
  const [cpSaving, setCpSaving] = useState(false);
  const role = (session?.user as { role?: string })?.role ?? "PARENT";

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError("");
    if (cpForm.next !== cpForm.confirm) { setCpError("New passwords do not match"); return; }
    if (cpForm.next.length < 8) { setCpError("New password must be at least 8 characters"); return; }
    setCpSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cpForm.current, newPassword: cpForm.next }),
      });
      const data = await res.json();
      if (!res.ok) { setCpError(data.error || "Failed to change password"); }
      else {
        setCpSuccess(true);
        setCpForm({ current: "", next: "", confirm: "" });
        setTimeout(() => { setCpSuccess(false); setShowChangePassword(false); }, 2000);
      }
    } finally {
      setCpSaving(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-1 text-gray-600 hover:text-[#1e3a5f] rounded-lg hover:bg-gray-100 flex-shrink-0"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile branding */}
        <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-full bg-[#c9a227] flex items-center justify-center">
            <span className="text-white font-bold text-[10px]">HF</span>
          </div>
          <span className="font-bold text-sm text-[#1e3a5f]">Holy Face</span>
        </div>

        {title && (
          <h1 className="text-lg sm:text-xl font-bold text-[#1e3a5f] hidden lg:block truncate">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <button className="relative p-2 text-gray-500 hover:text-[#1e3a5f] rounded-lg hover:bg-gray-100">
          <Bell className="w-5 h-5" />
        </button>
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#1e3a5f] flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="text-left hidden md:block">
              <div className="text-sm font-medium text-gray-800">
                {session?.user?.name}
              </div>
              <div className="text-xs text-gray-500">{roleLabel(role)}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
          </button>
          {open && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="text-sm font-medium">
                    {session?.user?.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {session?.user?.email}
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); setShowChangePassword(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <KeyRound className="w-4 h-4" />
                  Change Password
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-b-xl"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal open={showChangePassword} onClose={() => { setShowChangePassword(false); setCpError(""); setCpSuccess(false); setCpForm({ current: "", next: "", confirm: "" }); }} title="Change Password" size="sm">
        <form onSubmit={handleChangePassword} className="space-y-4">
          {cpSuccess && <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">Password changed successfully!</div>}
          {cpError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{cpError}</div>}
          <div>
            <label className="form-label">Current Password</label>
            <input type="password" className="form-input" value={cpForm.current} onChange={e => setCpForm(f => ({ ...f, current: e.target.value }))} required />
          </div>
          <div>
            <label className="form-label">New Password</label>
            <input type="password" className="form-input" value={cpForm.next} onChange={e => setCpForm(f => ({ ...f, next: e.target.value }))} required minLength={8} />
            <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
          </div>
          <div>
            <label className="form-label">Confirm New Password</label>
            <input type="password" className="form-input" value={cpForm.confirm} onChange={e => setCpForm(f => ({ ...f, confirm: e.target.value }))} required minLength={8} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setShowChangePassword(false); setCpError(""); setCpForm({ current: "", next: "", confirm: "" }); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={cpSaving} className="btn-primary">{cpSaving ? "Saving..." : "Change Password"}</button>
          </div>
        </form>
      </Modal>
    </header>
  );
}
