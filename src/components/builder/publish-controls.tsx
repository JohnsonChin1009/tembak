"use client";

import { useState } from "react";
import { Check, ExternalLink, Link2, LoaderCircle, Rocket, Undo2 } from "lucide-react";
import type { App } from "@/lib/types";

export function PublishControls({
  app,
  version,
  appsUrl,
  onChanged,
}: {
  app: App;
  version: number;
  appsUrl: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `${appsUrl}/a/${app.slug}`;
  const live = !!app.publishedVersion;
  const isLiveVersion = app.publishedVersion === version;

  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${app.id}/publish`, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify({ version }) : undefined,
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Failed");
      onChanged();
      if (method === "POST") await copy();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked; the link is still visible via Open
    }
  }

  const iconBtn =
    "grid size-8 place-items-center rounded-md text-faint transition hover:bg-hover hover:text-fg disabled:opacity-50";

  return (
    <div className="flex items-center gap-1">
      {error ? <span className="mr-2 text-xs text-danger">{error}</span> : null}
      {live ? (
        <>
          <button onClick={copy} className={iconBtn} aria-label="Copy live link" title={url}>
            {copied ? <Check className="size-4 text-accent" /> : <Link2 className="size-4" />}
          </button>
          <a href={url} target="_blank" rel="noreferrer" className={iconBtn} aria-label="Open live app" title={url}>
            <ExternalLink className="size-4" />
          </a>
          {isLiveVersion ? (
            <button onClick={() => call("DELETE")} disabled={busy} className={iconBtn} aria-label="Unpublish" title="Unpublish">
              <Undo2 className="size-4" />
            </button>
          ) : null}
        </>
      ) : null}
      {!isLiveVersion ? (
        <button
          onClick={() => call("POST")}
          disabled={busy}
          className="ml-1 flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}
          {live ? `Update live to v${version}` : "Publish"}
        </button>
      ) : copied ? (
        <span className="ml-1 text-xs font-medium text-accent">Link copied</span>
      ) : null}
    </div>
  );
}
