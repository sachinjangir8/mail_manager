import { isValidEmail } from "@reachinbox/shared";
import {
  ArrowLeft,
  Bold,
  Calendar,
  Check,
  Clock,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Underline,
  Undo,
  Upload,
  X,
} from "lucide-react";
import React, { useState } from "react";
import { CsvUploadModal } from "./CsvUploadModal";

export interface Sender {
  id: string;
  displayName: string;
  email: string;
}

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: Sender[];
  onSubmitSchedule: (payload: {
    senderId: string;
    subject: string;
    body: string;
    recipients: string[];
    scheduledAt: string;
    delayBetweenEmailsMs: number;
    hourlyLimit: number;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  senders,
  onSubmitSchedule,
  isSubmitting = false,
}) => {
  const [senderId, setSenderId] = useState<string>(senders[0]?.id || "");
  const [toInput, setToInput] = useState<string>("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState<string>("");
  const [delaySeconds, setDelaySeconds] = useState<number>(5);
  const [hourlyLimit, setHourlyLimit] = useState<number>(20);
  const [body, setBody] = useState<string>("");

  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [sendLaterOpen, setSendLaterOpen] = useState(false);

  // Scheduled date in UTC ISO (defaults to 10 minutes from now)
  const defaultDate = new Date(Date.now() + 10 * 60 * 1000);
  const [scheduledAt, setScheduledAt] = useState<string>(defaultDate.toISOString());

  if (!isOpen) return null;

  const handleAddRecipient = () => {
    const trimmed = toInput.trim().toLowerCase();
    if (trimmed && isValidEmail(trimmed) && !recipients.includes(trimmed)) {
      setRecipients([...recipients, trimmed]);
      setToInput("");
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleCsvParsed = (parsed: string[]) => {
    const combined = Array.from(new Set([...recipients, ...parsed]));
    setRecipients(combined);
  };

  const handlePresetTime = (hoursFromNow: number) => {
    const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    setScheduledAt(d.toISOString());
    setSendLaterOpen(false);
  };

  const handleScheduleSubmit = async () => {
    if (!senderId && senders.length > 0) {
      setSenderId(senders[0].id);
    }
    const finalSenderId = senderId || senders[0]?.id;
    if (!finalSenderId) {
      alert("Please configure or select a sender first");
      return;
    }
    if (recipients.length === 0) {
      alert("Please add at least one recipient email");
      return;
    }
    if (!subject.trim()) {
      alert("Subject cannot be empty");
      return;
    }

    await onSubmitSchedule({
      senderId: finalSenderId,
      subject,
      body: body || "<p>Hello,</p>",
      recipients,
      scheduledAt,
      delayBetweenEmailsMs: delaySeconds * 1000,
      hourlyLimit,
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden relative">
          {/* Top Bar matching Figma */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-base font-semibold text-gray-900">
                Compose New Email
              </h2>
            </div>

            <div className="flex items-center gap-3 relative">
              {/* Send Later trigger button */}
              <button
                id="btn-open-send-later"
                type="button"
                onClick={() => setSendLaterOpen(!sendLaterOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold transition"
              >
                <Clock className="w-3.5 h-3.5 text-gray-500" />
                Send Later
              </button>

              {/* Primary Green Submit Button */}
              <button
                id="btn-submit-schedule"
                onClick={handleScheduleSubmit}
                disabled={isSubmitting || recipients.length === 0 || !subject.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-50 text-white font-semibold text-sm shadow-sm transition"
              >
                {isSubmitting ? (
                  <span>Scheduling...</span>
                ) : (
                  <>
                    <span>Schedule Send</span>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>

              {/* Send Later Popover matching Figma Screen 5 */}
              {sendLaterOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      Send Later
                    </span>
                    <button
                      onClick={() => setSendLaterOpen(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-700 block mb-1">
                        Pick date & time
                      </label>
                      <input
                        type="datetime-local"
                        value={new Date(scheduledAt).toISOString().slice(0, 16)}
                        onChange={(e) => setScheduledAt(new Date(e.target.value).toISOString())}
                        className="w-full text-xs p-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-gray-400">Quick presets</span>
                      <button
                        onClick={() => handlePresetTime(1)}
                        className="w-full text-left text-xs p-2 rounded-lg hover:bg-gray-50 text-gray-700 transition"
                      >
                        In 1 Hour
                      </button>
                      <button
                        onClick={() => handlePresetTime(24)}
                        className="w-full text-left text-xs p-2 rounded-lg hover:bg-gray-50 text-gray-700 transition"
                      >
                        Tomorrow, 10:00 AM
                      </button>
                      <button
                        onClick={() => handlePresetTime(29)}
                        className="w-full text-left text-xs p-2 rounded-lg hover:bg-gray-50 text-gray-700 transition"
                      >
                        Tomorrow, 3:00 PM
                      </button>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                      <button
                        onClick={() => setSendLaterOpen(false)}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setSendLaterOpen(false)}
                        className="px-3 py-1.5 text-xs bg-brand-600 text-white font-semibold rounded-md hover:bg-brand-700 transition"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {/* From field */}
            <div className="px-6 py-3 flex items-center gap-4">
              <span className="text-sm font-medium text-gray-500 w-16">From</span>
              <select
                id="select-sender"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="flex-1 text-sm text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0 py-1"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            {/* To field with chip pills and Upload List button */}
            <div className="px-6 py-3 flex items-start gap-4">
              <span className="text-sm font-medium text-gray-500 w-16 pt-1.5">To</span>
              <div className="flex-1 flex flex-wrap items-center gap-2">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                  >
                    {email}
                    <button
                      onClick={() => handleRemoveRecipient(email)}
                      className="hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="input-recipient-email"
                  type="email"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleAddRecipient();
                    }
                  }}
                  placeholder={recipients.length === 0 ? "recipient@example.com (Press Enter)" : "Add more..."}
                  className="text-sm bg-transparent border-0 focus:outline-none focus:ring-0 min-w-[200px] py-1 text-gray-900 placeholder-gray-400"
                />
              </div>

              {/* Upload List Button matching Figma */}
              <button
                id="btn-upload-list"
                type="button"
                onClick={() => setCsvModalOpen(true)}
                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-semibold py-1.5 px-3 rounded-lg border border-brand-200 bg-brand-50/50 hover:bg-brand-50 transition shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload List
              </button>
            </div>

            {/* Subject field */}
            <div className="px-6 py-3 flex items-center gap-4">
              <span className="text-sm font-medium text-gray-500 w-16">Subject</span>
              <input
                id="input-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 text-sm text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0 py-1 placeholder-gray-400 font-medium"
              />
            </div>

            {/* Inline Schedulers Settings Row matching Figma Screen 5 */}
            <div className="px-6 py-3 flex items-center gap-8 bg-gray-50/60">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-600">
                  Delay between 2 emails:
                </span>
                <div className="flex items-center gap-1">
                  <input
                    id="input-delay-seconds"
                    type="number"
                    min="1"
                    max="3600"
                    value={delaySeconds}
                    onChange={(e) => setDelaySeconds(Number(e.target.value) || 5)}
                    className="w-14 text-center text-xs font-bold py-1 px-2 border border-gray-200 rounded-md focus:outline-none focus:border-brand-500"
                  />
                  <span className="text-xs text-gray-400">sec</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-600">
                  Hourly Limit:
                </span>
                <div className="flex items-center gap-1">
                  <input
                    id="input-hourly-limit"
                    type="number"
                    min="1"
                    max="1000"
                    value={hourlyLimit}
                    onChange={(e) => setHourlyLimit(Number(e.target.value) || 20)}
                    className="w-14 text-center text-xs font-bold py-1 px-2 border border-gray-200 rounded-md focus:outline-none focus:border-brand-500"
                  />
                  <span className="text-xs text-gray-400">/hr</span>
                </div>
              </div>

              <div className="text-xs text-gray-500 flex items-center gap-1.5 ml-auto">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Scheduled for: <span className="font-semibold text-gray-800">{new Date(scheduledAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Rich Editor Toolbar matching Figma */}
            <div className="px-6 py-2 flex items-center gap-1 bg-white border-b border-gray-100 flex-wrap">
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                title="Undo"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                title="Redo"
              >
                <Redo className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-gray-200 mx-1" />
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600 font-bold"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600 italic"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                title="Underline"
              >
                <Underline className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                title="Strikethrough"
              >
                <Strikethrough className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-gray-200 mx-1" />
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                title="Code"
              >
                <Code className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                title="Link"
              >
                <Link2 className="w-4 h-4" />
              </button>
            </div>

            {/* Email Body Text Area */}
            <div className="p-6">
              <textarea
                id="textarea-body"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type Your Reply..."
                className="w-full h-full text-sm text-gray-900 placeholder-gray-400 bg-transparent border-0 focus:outline-none focus:ring-0 resize-none font-sans leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recipient CSV Upload Modal */}
      <CsvUploadModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onRecipientsParsed={handleCsvParsed}
      />
    </>
  );
};
