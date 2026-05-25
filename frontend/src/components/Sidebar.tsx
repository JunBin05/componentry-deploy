import React from "react";

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  isAuthenticated: boolean;
  onLogout: () => void;
}

export default function Sidebar({ currentTab, onTabChange, isAuthenticated, onLogout }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "specs", label: "New Quote", icon: "add_circle" },
    { id: "catalog", label: "Catalog", icon: "inventory_2" },
    { id: "settings", label: "Settings", icon: "settings" },
  ];

  return (
    <aside className="w-64 border-r border-[#dadad7] bg-[#f5f4ef] flex flex-col h-screen sticky top-0 shrink-0 print:hidden">
      {/* Brand Logo/Header */}
      <div className="p-6 border-b border-[#dadad7] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#0d6e00] flex items-center justify-center text-[#ff3b30] font-display font-bold">
          <span className="material-symbols-outlined text-white text-lg font-bold">memory</span>
        </div>
        <div>
          <h1 className="font-display font-bold text-[#141514] tracking-tight leading-none text-lg">
            Componentry
          </h1>
          <span className="text-[10px] font-mono text-[#585956] tracking-widest uppercase">
            Quote Builder
          </span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-sans font-semibold transition-all duration-200 group text-left ${
                isActive
                  ? "bg-[#dadad7] text-[#141514] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]"
                  : "text-[#585956] hover:bg-[#e6e5df] hover:text-[#141514]"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] transition-colors ${
                  isActive ? "text-[#0d6e00]" : "text-[#878884] group-hover:text-[#585956]"
                }`}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.id === "specs" && (
                <span className="ml-auto text-[9px] font-mono bg-[#0d6e00] text-white px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                  Quote
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Supplier Section (Footer) */}
      <div className="p-4 border-t border-[#dadad7] bg-[#ecebe5]">
        {isAuthenticated ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#1c2c18] flex items-center justify-center border border-[#bccbb3]">
                <span className="material-symbols-outlined text-[#44d62c] text-sm">shield_person</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#141514] truncate leading-none">
                  Supplier Admin
                </p>
                <p className="text-[10px] font-mono text-[#585956] truncate mt-0.5">
                  Signed in
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-[#dadad7] text-xs font-semibold text-[#8a1a1a] hover:bg-[#faeae8] hover:border-[#eba1a1] transition-all bg-[#faf9f6]"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              <span>Log out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => onTabChange("auth")}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#141514] hover:bg-black text-[#faf9f6] text-xs font-semibold shadow-sm transition-all duration-200"
          >
            <span className="material-symbols-outlined text-sm text-[#44d62c]">lock_open</span>
            <span>Log in</span>
          </button>
        )}
      </div>
    </aside>
  );
}
