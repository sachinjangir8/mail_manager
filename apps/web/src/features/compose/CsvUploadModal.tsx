import { parseRecipientsContent, RecipientParseResult } from "@reachinbox/shared";
import { AlertCircle, CheckCircle, Copy, FileText, Upload, X } from "lucide-react";
import React, { useRef, useState } from "react";

export interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecipientsParsed: (recipients: string[]) => void;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  isOpen,
  onClose,
  onRecipientsParsed,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseResult, setParseResult] = useState<RecipientParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = parseRecipientsContent(content);
      setParseResult(result);
    };
    reader.readAsText(file);
  };

  const handleApply = () => {
    if (parseResult && parseResult.valid.length > 0) {
      onRecipientsParsed(parseResult.valid);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-semibold text-gray-900">Upload Recipient List</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* File Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 hover:border-brand-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition bg-gray-50/50 hover:bg-brand-50/20"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {fileName ? fileName : "Click or drag & drop CSV or TXT file here"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Supports CSV with &apos;email&apos; header, plain-text email lists, and comma/line separated lists
            </p>
          </div>

          {/* Parsing Results Breakdown */}
          {parseResult && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-100">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Validation Summary
              </h4>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg border border-gray-100 flex items-center gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-base font-bold text-gray-900 block">
                      {parseResult.valid.length}
                    </span>
                    <span className="text-xs text-gray-500">Valid Emails</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-gray-100 flex items-center gap-2.5">
                  <Copy className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-base font-bold text-gray-900 block">
                      {parseResult.duplicates.length}
                    </span>
                    <span className="text-xs text-gray-500">Duplicates Removed</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-lg border border-gray-100 flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <div>
                    <span className="text-base font-bold text-gray-900 block">
                      {parseResult.invalid.length}
                    </span>
                    <span className="text-xs text-gray-500">Invalid Rejected</span>
                  </div>
                </div>
              </div>

              {parseResult.invalid.length > 0 && (
                <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 max-h-24 overflow-y-auto">
                  <p className="font-semibold mb-1">Rejected invalid entries:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {parseResult.invalid.slice(0, 10).map((inv, idx) => (
                      <li key={idx} className="font-mono">{inv}</li>
                    ))}
                    {parseResult.invalid.length > 10 && (
                      <li>...and {parseResult.invalid.length - 10} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!parseResult || parseResult.valid.length === 0}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            Apply {parseResult?.valid.length ? `(${parseResult.valid.length} Emails)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
};
