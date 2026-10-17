import Papa from "papaparse";
import type { Row } from "@/lib/types";

export const MAX_ROWS = 5000;

/** "Sign Ups (Total)" -> "sign_ups_total", so generated code can use r.sign_ups_total. */
export function columnKey(header: string, i: number): string {
  const k = header
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return k || `column_${i + 1}`;
}

const NUMERIC_RE = /^-?(?:[$€£¥]|RM|USD|MYR)?\s?\d[\d,]*(?:\.\d+)?%?$/i;

function cell(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "boolean") return v;
  const s = String(v).trim();
  if (s === "") return null;
  if (NUMERIC_RE.test(s)) {
    const n = Number(s.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return s;
}

/** First row is the header. Blank rows are dropped. */
export function rowsFromTable(table: unknown[][]): Row[] {
  const [header, ...body] = table.filter((r) => r.some((c) => String(c ?? "").trim() !== ""));
  if (!header) return [];
  const keys = header.map((h, i) => columnKey(String(h ?? ""), i));
  const seen = new Map<string, number>();
  const unique = keys.map((k) => {
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return n ? `${k}_${n + 1}` : k;
  });
  return body.slice(0, MAX_ROWS).map((r) => {
    const row: Row = {};
    unique.forEach((k, i) => (row[k] = cell(r[i])));
    return row;
  });
}

export function rowsFromCsv(text: string): Row[] {
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  return rowsFromTable(parsed.data);
}

/** Accepts an array of objects, or an object with an array property. */
export function rowsFromJson(data: unknown): Row[] {
  let arr: unknown = data;
  if (!Array.isArray(arr) && arr && typeof arr === "object") {
    arr = Object.values(arr).find(Array.isArray) ?? [arr];
  }
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, MAX_ROWS).map((item) => {
    const row: Row = {};
    if (item && typeof item === "object") {
      Object.entries(item as Record<string, unknown>).forEach(([k, v], i) => {
        row[columnKey(k, i)] = typeof v === "object" && v !== null ? JSON.stringify(v) : cell(v);
      });
    } else {
      row.value = cell(item);
    }
    return row;
  });
}
