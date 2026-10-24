import { CheckCircle2, ExternalLink, Star } from "lucide-react";
import React from "react";
import { StatusBadge } from "../../components/common/Badge";
import { formatLocalTime } from "../../lib/utils";

export interface SentEmailItem {
  id: string;
  campaignId: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: string;
  etherealPreviewUrl: string | null;
  failureReason: string | null;
}

export interface SentListProps {
  items: SentEmailItem[];
  isLoading: boolean;
  onSelectEmail: (email: SentEmailItem) => void;
}

export const SentList: React.FC<SentListProps> = ({
  items,
  isLoading,
  onSelectEmail,
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
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">No sent emails yet</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm">
          Emails sent by the BullMQ worker will be captured and displayed here with live Ethereal preview URLs.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {items.map((email) => {
        const snippet = email.body.replace(/<[^>]*>?/gm, "").slice(0, 90);

        return (
          <div
            key={email.id}
            onClick={() => onSelectEmail(email)}
            className="flex items-center justify-between px-6 py-4 hover:bg-white transition cursor-pointer group bg-[#FAFAFA]/50"
          >
            {/* Left section: Recipient */}
            <div className="flex items-center gap-4 min-w-[280px] max-w-[320px]">
              <button
                onClick={(e) => e.stopPropagation()}
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

            {/* Middle section: Status Badge + Subject & Snippet (matching Figma) */}
            <div className="flex-1 flex items-center gap-3 overflow-hidden px-4">
              <StatusBadge status={email.status} />
              <div className="overflow-hidden flex items-baseline gap-2">
                <span className="text-sm font-medium text-gray-900 shrink-0">
                  {email.subject}
                </span>
                <span className="text-sm text-gray-400 truncate">
                  - {snippet}...
                </span>
              </div>
            </div>

            {/* Right section: Ethereal Link & Sent Time */}
            <div className="flex items-center gap-4 shrink-0">
              {email.etherealPreviewUrl && (
                <a
                  href={email.etherealPreviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open Ethereal Email Preview"
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-md transition font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ethereal Preview
                </a>
              )}
              <span className="text-xs text-gray-400">
                {formatLocalTime(email.sentAt || email.scheduledAt)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
