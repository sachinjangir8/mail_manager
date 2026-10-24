import { ArrowLeft, ExternalLink, FileText, Star, Trash2 } from "lucide-react";
import React from "react";
import { StatusBadge } from "../../components/common/Badge";
import { formatFullLocalTime } from "../../lib/utils";

export interface EmailDetailModalProps {
  email: any;
  onClose: () => void;
  onCancel?: (id: string) => void;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({
  email,
  onClose,
  onCancel,
}) => {
  if (!email) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Top Header matching Figma Screen 4 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold text-gray-900 truncate max-w-md">
              {email.subject}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={email.status} time={email.scheduledAt} />
            <button className="p-2 text-gray-400 hover:text-amber-400 transition">
              <Star className="w-4 h-4" />
            </button>
            {email.status !== "sent" && onCancel && (
              <button
                onClick={() => {
                  onCancel(email.id);
                  onClose();
                }}
                className="p-2 text-gray-400 hover:text-red-600 transition"
                title="Cancel email"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sender details and metadata */}
        <div className="p-6 border-b border-gray-50 flex items-start justify-between bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
              {email.senderName?.[0] || email.senderEmail?.[0] || "S"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">
                  {email.senderName || "Sender"}
                </span>
                <span className="text-xs text-gray-400">
                  &lt;{email.senderEmail}&gt;
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                To: <span className="font-medium text-gray-700">{email.recipientEmail}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-400 font-medium block">
              {formatFullLocalTime(email.sentAt || email.scheduledAt)}
            </span>
            {email.etherealPreviewUrl && (
              <a
                href={email.etherealPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1 font-semibold"
              >
                <ExternalLink className="w-3 h-3" /> View in Ethereal
              </a>
            )}
          </div>
        </div>

        {/* Email Body Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div
            className="prose prose-sm max-w-none text-gray-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: email.body }}
          />

          {/* Sample Callout box matching Figma screen 4 */}
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-sm space-y-1">
            <p className="font-semibold flex items-center gap-2">
              ⚡ Delivery & Verification Note
            </p>
            <p className="text-xs text-amber-800">
              This email was coordinated via BullMQ with atomic Redis rate limit reservation. Ethereal capture guarantees safe test inspection without sending to real inboxes.
            </p>
          </div>

          {/* Sample Attachments cards matching Figma */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Attachments (2 files)
            </h4>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <div className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-brand-500 transition cursor-pointer">
                <div className="w-8 h-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-xs font-medium text-gray-900 block truncate">
                    Campaign_Summary.pdf
                  </span>
                  <span className="text-[10px] text-gray-400">1.5 KB</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-brand-500 transition cursor-pointer">
                <div className="w-8 h-8 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-xs font-medium text-gray-900 block truncate">
                    Recipient_Audit.csv
                  </span>
                  <span className="text-[10px] text-gray-400">1.2 KB</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-400">
            Job ID: <span className="font-mono text-gray-600">{email.jobId || "N/A"}</span>
            {email.attemptCount > 0 && ` • Attempt ${email.attemptCount}`}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
