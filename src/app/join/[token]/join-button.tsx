"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function JoinButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/join/${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { slug?: string; error?: string };
    if (!res?.ok || !data.slug) {
      setError(data.error ?? "Couldn't join right now");
      setBusy(false);
      return;
    }
    router.push(`/w/${data.slug}`);
  }

  return (
    <div className="space-y-3">
      <button
        onClick={join}
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent font-medium text-accent-ink transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Join workspace
        <ArrowRight className="size-4" />
      </button>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
