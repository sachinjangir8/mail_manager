import { Clock, Star, Trash2 } from "lucide-react";
import React from "react";
import { StatusBadge } from "../../components/common/Badge";
import { formatLocalTime } from "../../lib/utils";

export interface ScheduledEmailItem {
  id: string;
  campaignId: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: string;
  attemptCount: number;
}

export interface ScheduledListProps {
  items: ScheduledEmailItem[];
  isLoading: boolean;
  onSelectEmail: (email: ScheduledEmailItem) => void;
  onCancelEmail?: (id: string) => void;
}

export const ScheduledList: React.FC<ScheduledListProps> = ({
  items,
  isLoading,
  onSelectEmail,
  onCancelEmail,
}) => {
  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-white rounded-xl border border-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-3">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">No scheduled emails</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          Emails you schedule for future dispatch will appear here. Click &quot;Compose&quot; to schedule your first email campaign.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {items.map((email) => {
        // Strip tags for clean snippet
        const snippet = email.body.replace(/<[^>]*>?/gm, "").slice(0, 90);

        return (
          <div
            key={email.id}
            onClick={() => onSelectEmail(email)}
            className="flex items-center justify-between px-6 py-4 hover:bg-white transition cursor-pointer group bg-[#FAFAFA]/50"
          >
            {/* Left section: Recipient and scheduled badge */}
            <div className="flex items-center gap-4 min-w-[280px] max-w-[320px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="text-gray-300 hover:text-amber-400 transition"
              >
                <Star className="w-4 h-4" />
              </button>
              <div className="overflow-hidden">
                <span className="text-sm font-semibold text-gray-900 block truncate">
                  To: {email.recipientEmail}
                </span>
                <span className="text-xs text-gray-400 block truncate">
                  From: {email.senderName || email.senderEmail}
                </span>
              </div>
            </div>

            {/* Middle section: Scheduled Time Badge & Subject + Snippet (matching Figma) */}
            <div className="flex-1 flex items-center gap-3 overflow-hidden px-4">
              <StatusBadge status={email.status} time={email.scheduledAt} />
              <div className="overflow-hidden flex items-baseline gap-2">
                <span className="text-sm font-medium text-gray-900 shrink-0">
                  {email.subject}
                </span>
                <span className="text-sm text-gray-400 truncate">
                  - {snippet}...
                </span>
              </div>
            </div>

            {/* Right section: Scheduled Time & Actions */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-gray-400">
                {formatLocalTime(email.scheduledAt)}
              </span>
              {onCancelEmail && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelEmail(email.id);
                  }}
                  title="Cancel scheduled send"
                  className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
