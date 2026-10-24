import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import React from "react";
import { cn, formatLocalTime } from "../../lib/utils";

export interface StatusBadgeProps {
  status: string;
  time?: string | null;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, time, className }) => {
  switch (status.toLowerCase()) {
    case "scheduled":
    case "queued":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]",
            className
          )}
        >
          <Clock className="w-3.5 h-3.5 text-[#D97706]" />
          {time ? formatLocalTime(time) : "Scheduled"}
        </span>
      );

    case "sent":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]",
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
          Sent
        </span>
      );

    case "rate_limited":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#FEF9C3] text-[#854D0E] border border-[#FEF08A]",
            className
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#CA8A04]" />
          Rate Limited (Rescheduled)
        </span>
      );

    case "failed":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]",
            className
          )}
        >
          <XCircle className="w-3.5 h-3.5 text-[#DC2626]" />
          Failed
        </span>
      );

    case "cancelled":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200",
            className
          )}
        >
          Cancelled
        </span>
      );

    default:
      return (
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800",
            className
          )}
        >
          {status}
        </span>
      );
  }
};
