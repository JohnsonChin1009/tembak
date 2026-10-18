"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { GETTING_STARTED_CHANNEL } from "@/lib/onboarding";

export function NewWorkspaceForm() {
  const [name, setName] = useState("");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { slug?: string; error?: string };
    if (!res?.ok || !data.slug) {
      setError(data.error ?? "Couldn't create the workspace");
      setBusy(false);
      return;
    }
    // New workspaces open on the guided first build.
    router.push(`/w/${data.slug}/c/${GETTING_STARTED_CHANNEL}`);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-medium text-muted" htmlFor="ws-name">
        Workspace name
      </label>
      <input
        id="ws-name"
        autoFocus
        maxLength={40}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Acme Marketing"
        className="h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-fg outline-none transition placeholder:text-faint focus:border-accent"
      />
      <button
        type="submit"
        disabled={busy || !name.trim()}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent font-medium text-accent-ink transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Create workspace
        <ArrowRight className="size-4" />
      </button>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
