import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a UTC date string into the user's local timezone (e.g. "Tue 9:05 AM")
 */
export function formatLocalTime(utcDateStr: string | null | undefined): string {
  if (!utcDateStr) return "N/A";
  const date = new Date(utcDateStr);
  if (isNaN(date.getTime())) return "Invalid date";

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = days[date.getDay()];

  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'

  return `${dayName} ${hours}:${minutes} ${ampm}`;
}

export function formatFullLocalTime(utcDateStr: string | null | undefined): string {
  if (!utcDateStr) return "N/A";
  const date = new Date(utcDateStr);
  if (isNaN(date.getTime())) return "Invalid date";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
