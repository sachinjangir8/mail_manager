import { Filter, RefreshCw, Search } from "lucide-react";
import React, { useState } from "react";

export interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing = false,
}) => {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between gap-4 shrink-0">
      {/* Search Input Bar (matching Figma) */}
      <div className="relative flex-1 max-w-2xl">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          id="input-global-search"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by subject, recipient, or sender..."
          className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50/70 border border-gray-200 rounded-lg placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition"
        />
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterMenuOpen(!filterMenuOpen)}
          title="Filter emails"
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition"
        >
          <Filter className="w-4 h-4" />
        </button>

        <button
          id="btn-refresh-list"
          onClick={onRefresh}
          title="Refresh email list"
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-brand-600" : ""}`} />
        </button>
      </div>
    </header>
  );
};
