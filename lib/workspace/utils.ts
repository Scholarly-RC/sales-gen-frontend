import { format } from "date-fns";

import type {
  ClientExport,
  ClientSaleFormItem,
  OcrJob,
} from "@/types/workspace";

export const MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024;

export function upsertOcrJobs(current: OcrJob[], updates: OcrJob[]) {
  const map = new Map(current.map((job) => [job.id, job]));
  for (const job of updates) {
    map.set(job.id, job);
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function buildWebSocketUrl(token: string) {
  const explicit = process.env.NEXT_PUBLIC_API_WS_URL;
  if (explicit) {
    const normalized = explicit.endsWith("/")
      ? explicit.slice(0, -1)
      : explicit;
    return `${normalized}/ws/ocr-jobs?token=${encodeURIComponent(token)}`;
  }

  const proxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";
  const wsBase = proxyTarget.replace(/^http/, "ws").replace(/\/$/, "");
  return `${wsBase}/ws/ocr-jobs?token=${encodeURIComponent(token)}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function normalizeDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return format(parsed, "yyyy-MM-dd");
}

export function formatDateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function formatDiscountDisplay(entry: ClientExport) {
  if (entry.discount_type !== "percent") {
    return entry.discount_value.toFixed(2);
  }

  const appliedAmount = Math.max(entry.subtotal - entry.total, 0);
  return `${entry.discount_value.toFixed(2)}% (${appliedAmount.toFixed(2)})`;
}

export function calculateSaleItemLineTotal(item: ClientSaleFormItem): number {
  return Math.max(Number(item.quantity) * Number(item.unitPrice), 0);
}
