import React, { useState, useEffect } from "react";
import { User, DbStatus } from "../types";
import { LogIn, LogOut, Database, UserCheck, Sparkles, Activity, ClipboardList } from "lucide-react";

interface TopbarProps {
  activeTab: "live" | "analytics" | "settings";
  onSelectTab: (tab: "live" | "analytics" | "settings") => void;
  user: User | null;
  dbStatus: DbStatus | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onQuickDemo: () => void;
  onOpenSurvey?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  activeTab,
  onSelectTab,
  user,
  dbStatus,
  onOpenAuth,
  onLogout,
  onQuickDemo,
  onOpenSurvey,
}) => {
  const [time, setTime] = useState<string>("--:--:--");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const initial = user?.displayName ? user.displayName.charAt(0).toUpperCase() : "G";

  return (
    <header className="h-14 shrink-0 px-4 md:px-6 border-b border-[#1a3448] bg-[#0c1a28] flex items-center justify-between select-none">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#35d0e8] to-[#1a8fa3] flex items-center justify-center font-display font-bold text-[#03181e] text-sm shadow-sm shadow-[#35d0e8]/30">
          K
        </div>
        <div className="font-display font-bold text-base tracking-wider text-[#eaf3fa]">
          KAY<span className="text-[#35d0e8]">AGNI</span> <span className="text-xs text-[#9db3c2] font-mono">AI</span>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="hidden sm:flex items-center gap-1 bg-[#091522] p-1 rounded-lg border border-[#1a3448]">
        <button
          type="button"
          onClick={() => onSelectTab("live")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors flex items-center gap-1.5 ${
            activeTab === "live"
              ? "bg-[#0e2434] text-[#eaf3fa] border border-[#1a3448] shadow-sm"
              : "text-[#9db3c2] hover:text-[#eaf3fa]"
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-[#35d0e8]" />
          Live Session
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("analytics")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors ${
            activeTab === "analytics"
              ? "bg-[#0e2434] text-[#eaf3fa] border border-[#1a3448] shadow-sm"
              : "text-[#9db3c2] hover:text-[#eaf3fa]"
          }`}
        >
          Analytics & History
        </button>
        <button
          type="button"
          onClick={() => onSelectTab("settings")}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors ${
            activeTab === "settings"
              ? "bg-[#0e2434] text-[#eaf3fa] border border-[#1a3448] shadow-sm"
              : "text-[#9db3c2] hover:text-[#eaf3fa]"
          }`}
        >
          Settings
        </button>
      </nav>

      {/* Right User & Database Zone */}
      <div className="flex items-center gap-2 md:gap-3 text-xs">
        {/* SIH Survey Button */}
        {onOpenSurvey && (
          <button
            type="button"
            onClick={onOpenSurvey}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#241c10] border border-[#f5a83c]/50 text-[#f5a83c] hover:bg-[#342714] transition-colors shadow-sm"
            title="Smart India Hackathon 2026 Survey Report (Due 11 Oct)"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Survey Link</span>
            <span className="px-1 py-0.2 rounded text-[10px] bg-[#f5a83c]/20 text-[#f7d6a5] font-mono">11 Oct</span>
          </button>
        )}

        {/* DB Status Badge */}
        <div
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#1a3448] bg-[#091522]"
          title={dbStatus?.message || "Database status"}
        >
          <Database className="w-3 h-3 text-[#35d0e8]" />
          <span className="text-[#9db3c2] font-mono text-[11px]">
            {dbStatus?.mode === "mongodb_atlas" ? "MongoDB Atlas" : "MongoDB (Embedded)"}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              dbStatus?.connected ? "bg-[#3ddc97] shadow-[0_0_6px_#3ddc97]" : "bg-[#f5a83c]"
            }`}
          />
        </div>

        {/* Live Clock */}
        <span className="text-[#9db3c2] font-mono text-xs hidden lg:inline-block">{time}</span>

        {/* Auth Zone */}
        {user ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#2b5468] to-[#1a3245] flex items-center justify-center font-display text-xs text-[#35d0e8] border border-[#1a3448]">
              {initial}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="font-semibold text-[#eaf3fa] text-xs leading-none max-w-[100px] truncate">
                {user.displayName}
              </span>
              <span className="text-[10px] text-[#5c7a8e] font-mono leading-tight">Verified</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 text-[#9db3c2] hover:text-[#ef6461] hover:bg-[#0e2434] rounded transition-colors ml-1"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onQuickDemo}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-[#1a3245] text-[#35d0e8] border border-[#1f5a68] hover:bg-[#23435c] transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              Demo Login
            </button>
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#35d0e8] text-[#04191f] hover:bg-[#4fdcef] transition-colors shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
