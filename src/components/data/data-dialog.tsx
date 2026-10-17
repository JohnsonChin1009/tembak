"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Copy, Database, FileSpreadsheet, Globe, LoaderCircle, Trash2, X } from "lucide-react";
import type { Source } from "@/lib/types";

type Tab = "sheet" | "csv" | "json";

export function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal
        onMouseDown={(e) => e.stopPropagation()}
        className={clsx(
          "max-h-[90vh] w-full overflow-auto rounded-2xl border border-line-strong bg-panel shadow-2xl shadow-black/60",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AddDataDialog({
  serviceAccountEmail,
  onClose,
  onCreated,
}: {
  serviceAccountEmail?: string;
  onClose: () => void;
  onCreated: (s: Source) => void;
}) {
  const [tab, setTab] = useState<Tab>("sheet");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [csv, setCsv] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [headerValue, setHeaderValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const config =
      tab === "sheet"
        ? { kind: "sheet", url }
        : tab === "csv"
          ? { kind: "csv", text: csv }
          : { kind: "json", url, headerName: headerName || undefined, headerValue: headerValue || undefined };
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name || defaultName(tab), config }),
      });
      const body = (await res.json()) as Source & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't add that source");
      onCreated(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that source");
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setCsv(await file.text());
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
  }

  const input =
    "h-10 w-full rounded-lg border border-line-strong bg-raised px-3 text-sm outline-none transition placeholder:text-faint focus:border-accent";

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-semibold">Add data</h2>
            <p className="mt-0.5 text-xs text-muted">Apps Tembak builds can read this. Secrets stay on the server.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
            {(
              [
                ["sheet", "Google Sheet", FileSpreadsheet],
                ["csv", "CSV", Database],
                ["json", "JSON API", Globe],
              ] as const
            ).map(([t, label, Icon]) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={clsx(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
                  tab === t ? "bg-raised text-fg shadow-sm" : "text-faint hover:text-muted",
                )}
              >
                <Icon className="size-3.5" /> {label}
              </button>
            ))}
          </div>

          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName(tab)} className={input} />
          </Field>

          {tab === "sheet" ? (
            <>
              <Field label="Sheet link">
                <input
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className={input}
                />
              </Field>
              <div className="rounded-lg border border-line bg-bg p-3 text-xs leading-relaxed text-muted">
                {serviceAccountEmail ? (
                  <>
                    Share the sheet with Tembak as a <strong className="text-fg">Viewer</strong>:
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(serviceAccountEmail);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }}
                      className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-md border border-line-strong bg-raised px-2 py-1.5 font-mono text-[11px] text-fg"
                    >
                      <span className="truncate">{serviceAccountEmail}</span>
                      {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5 text-faint" />}
                    </button>
                    <span className="mt-1.5 block">Or set it to &quot;Anyone with the link can view&quot;.</span>
                  </>
                ) : (
                  <>Set the sheet to &quot;Anyone with the link can view&quot;, or share it with the Tembak service account.</>
                )}
              </div>
            </>
          ) : null}

          {tab === "csv" ? (
            <Field label="CSV" hint="Paste it, or pick a file. The first row is the header.">
              <textarea
                required
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={6}
                placeholder={"week,channel,spend,signups\n2026-10-05,Google Ads,4200,88"}
                className="w-full rounded-lg border border-line-strong bg-raised p-3 font-mono text-xs outline-none focus:border-accent"
              />
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                className="mt-2 block text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-hover file:px-3 file:py-1.5 file:text-xs file:text-fg"
              />
            </Field>
          ) : null}

          {tab === "json" ? (
            <>
              <Field label="URL" hint="An https endpoint that returns a JSON array (or an object containing one).">
                <input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/v1/orders" className={input} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Auth header (optional)">
                  <input value={headerName} onChange={(e) => setHeaderName(e.target.value)} placeholder="Authorization" className={input} />
                </Field>
                <Field label="Value">
                  <input
                    type="password"
                    value={headerValue}
                    onChange={(e) => setHeaderValue(e.target.value)}
                    placeholder="Bearer ..."
                    className={input}
                  />
                </Field>
              </div>
            </>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
          <button type="button" onClick={onClose} className="h-9 rounded-lg px-4 text-sm text-muted hover:bg-hover hover:text-fg">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            {busy ? "Checking..." : "Connect"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function defaultName(tab: Tab) {
  return tab === "sheet" ? "Campaign sheet" : tab === "csv" ? "Uploaded data" : "API data";
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-faint">{hint}</span> : null}
    </label>
  );
}

export function SourceDialog({
  source,
  onClose,
  onDeleted,
}: {
  source: Source;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/sources/${source.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onDeleted(source.id);
  }
  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{source.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded bg-hover px-1.5 py-0.5 font-mono text-[11px] text-fg">{source.key}</span>
            <span>{kindLabel(source)}</span>
            {source.rowCount != null ? <span>· {source.rowCount.toLocaleString()} rows</span> : null}
            <span>· {source.columns.length} columns</span>
          </p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="p-5">
        <p className="mb-3 text-sm text-muted">
          Ask <span className="text-accent">@tembak</span> to build with <strong className="text-fg">{source.name}</strong> and it will
          use these columns.
        </p>
        <PreviewTable source={source} />
      </div>
      <div className="flex justify-between border-t border-line px-5 py-4">
        {source.kind !== "sample" ? (
          <button
            onClick={remove}
            disabled={busy}
            className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
          >
            <Trash2 className="size-4" /> Remove
          </button>
        ) : (
          <span className="self-center text-xs text-faint">Built-in sample dataset</span>
        )}
        <button onClick={onClose} className="h-9 rounded-lg bg-hover px-4 text-sm font-medium hover:bg-line-strong">
          Done
        </button>
      </div>
    </Modal>
  );
}

export function PreviewTable({ source }: { source: Source }) {
  if (!source.sample.length) return <p className="text-sm text-faint">No rows found.</p>;
  return (
    <div className="overflow-auto rounded-xl border border-line">
      <table className="w-full text-xs">
        <thead className="bg-raised text-left text-faint">
          <tr>
            {source.columns.map((c) => (
              <th key={c} className="whitespace-nowrap px-3 py-2 font-mono font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {source.sample.map((r, i) => (
            <tr key={i}>
              {source.columns.map((c) => (
                <td key={c} className={clsx("whitespace-nowrap px-3 py-2", typeof r[c] === "number" && "text-right tabular-nums")}>
                  {r[c] == null ? <span className="text-faint">—</span> : String(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function kindLabel(s: Source) {
  return { sheet: "Google Sheet", csv: "CSV", json: "JSON API", sample: "Sample" }[s.kind];
}
