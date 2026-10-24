import {
  Activity,
  Calendar,
  ChevronDown,
  ExternalLink,
  FileCode,
  LogOut,
  Mail,
  Plus,
  Send,
  Slack,
} from "lucide-react";
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../lib/utils";

export interface SidebarProps {
  activeTab: "scheduled" | "sent" | "senders" | "slack";
  onTabChange: (tab: "scheduled" | "sent" | "senders" | "slack") => void;
  onOpenCompose: () => void;
  scheduledCount?: number;
  sentCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenCompose,
  scheduledCount = 0,
  sentCount = 0,
}) => {
  const { user, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="p-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tracking-tight text-gray-900 font-sans">
            ONB
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
            ReachInbox
          </span>
        </div>
      </div>

      {/* User Profile Card with Dropdown */}
      <div className="px-4 mb-4 relative">
        <div
          onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/80 transition cursor-pointer"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-semibold flex items-center justify-center text-sm">
                {user?.name?.[0] || "U"}
              </div>
            )}
            <div className="overflow-hidden">
              <h4 className="text-sm font-semibold text-gray-900 truncate">
                {user?.name || "Oliver Brown"}
              </h4>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || "oliver.brown@domain.io"}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </div>

        {profileDropdownOpen && (
          <div className="absolute top-full left-4 right-4 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
            <button
              onClick={() => {
                setProfileDropdownOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Primary Compose Button (Figma emerald green) */}
      <div className="px-4 mb-6">
        <button
          id="btn-compose-email"
          onClick={onOpenCompose}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white font-semibold text-sm shadow-sm shadow-brand-600/20 hover:shadow-md transition duration-150"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          Compose
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 space-y-6">
        {/* CORE SECTION */}
        <div>
          <span className="px-3 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
            Core
          </span>
          <nav className="mt-2 space-y-1">
            <button
              id="nav-scheduled"
              onClick={() => onTabChange("scheduled")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition",
                activeTab === "scheduled"
                  ? "bg-brand-50 text-brand-800 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <Calendar
                  className={cn(
                    "w-4 h-4",
                    activeTab === "scheduled" ? "text-brand-600" : "text-gray-400"
                  )}
                />
                Scheduled
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-semibold",
                  activeTab === "scheduled"
                    ? "bg-brand-200/80 text-brand-900"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {scheduledCount}
              </span>
            </button>

            <button
              id="nav-sent"
              onClick={() => onTabChange("sent")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition",
                activeTab === "sent"
                  ? "bg-brand-50 text-brand-800 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <Send
                  className={cn(
                    "w-4 h-4",
                    activeTab === "sent" ? "text-brand-600" : "text-gray-400"
                  )}
                />
                Sent
              </div>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-semibold",
                  activeTab === "sent"
                    ? "bg-brand-200/80 text-brand-900"
                    : "bg-gray-100 text-gray-500"
                )}
              >
                {sentCount}
              </span>
            </button>
          </nav>
        </div>

        {/* INTEGRATIONS SECTION */}
        <div>
          <span className="px-3 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
            Settings & Integrations
          </span>
          <nav className="mt-2 space-y-1">
            <button
              id="nav-slack"
              onClick={() => onTabChange("slack")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition",
                activeTab === "slack"
                  ? "bg-brand-50 text-brand-800 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <Slack
                  className={cn(
                    "w-4 h-4",
                    activeTab === "slack" ? "text-brand-600" : "text-gray-400"
                  )}
                />
                Slack Alerts
              </div>
            </button>

            <button
              id="nav-senders"
              onClick={() => onTabChange("senders")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition",
                activeTab === "senders"
                  ? "bg-brand-50 text-brand-800 font-semibold"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-3">
                <Mail
                  className={cn(
                    "w-4 h-4",
                    activeTab === "senders" ? "text-brand-600" : "text-gray-400"
                  )}
                />
                Email Senders
              </div>
            </button>
          </nav>
        </div>

        {/* OPERATIONS & DOCS */}
        <div>
          <span className="px-3 text-[11px] font-bold tracking-wider text-gray-400 uppercase">
            Observability
          </span>
          <nav className="mt-2 space-y-1">
            <a
              href="http://localhost:4000/api/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-gray-400" />
                BullMQ Dashboard
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>

            <a
              href="http://localhost:4000/api/docs"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <FileCode className="w-4 h-4 text-gray-400" />
                OpenAPI Docs
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>
          </nav>
        </div>
      </div>
    </aside>
  );
};
