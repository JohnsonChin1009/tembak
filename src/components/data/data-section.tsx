"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Database, FileSpreadsheet, Globe, Plus, Sparkle } from "lucide-react";
import { Section } from "@/components/workspace/sidebar";
import type { Source, SourceKind } from "@/lib/types";
import { ProviderMark } from "./connector-panel";
import { AddDataDialog, SourceDialog, type Tab } from "./data-dialog";

const NotionIcon = ({ className }: { className?: string }) => <ProviderMark provider="notion" className={className} />;
const LinearIcon = ({ className }: { className?: string }) => <ProviderMark provider="linear" className={className} />;
const ICONS: Record<SourceKind, React.ComponentType<{ className?: string }>> = {
  sheet: FileSpreadsheet,
  csv: Database,
  json: Globe,
  sample: Sparkle,
  notion: NotionIcon,
  linear: LinearIcon,
};

/** After an OAuth round trip the URL carries ?connected=notion or ?connect_error=...&provider=notion. */
function oauthReturn(params: URLSearchParams): { tab: Tab; error: string | null } | null {
  const provider = params.get("connected") ?? params.get("provider");
  if (provider !== "notion" && provider !== "linear") return null;
  return { tab: provider, error: params.get("connect_error") };
}

export function DataSection({
  sources,
  serviceAccountEmail,
  onChange,
}: {
  sources: Source[];
  serviceAccountEmail?: string;
  onChange: (sources: Source[]) => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [returned] = useState(() => oauthReturn(params));
  const [adding, setAdding] = useState(!!returned);
  const [viewing, setViewing] = useState<Source | null>(null);

  // Drop the OAuth query params so a reload doesn't reopen the dialog.
  useEffect(() => {
    if (!returned) return;
    const next = new URLSearchParams(params);
    for (const k of ["connected", "connect_error", "provider"]) next.delete(k);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
    // Only once, on the return from the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Section
        title="Data"
        action={
          <button onClick={() => setAdding(true)} className="rounded p-1 text-faint hover:bg-hover hover:text-fg" aria-label="Add data">
            <Plus className="size-3.5" />
          </button>
        }
      >
        {sources.length === 0 ? (
          <p className="px-2 py-1 text-xs text-faint">Connect data so Tembak builds with your real numbers.</p>
        ) : null}
        {sources.map((s) => {
          const Icon = ICONS[s.kind];
          return (
            <button
              key={s.id}
              onClick={() => setViewing(s)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted transition hover:bg-hover/60 hover:text-fg"
            >
              <Icon className="size-3.5 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
            </button>
          );
        })}
        <button
          onClick={() => setAdding(true)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-faint transition hover:bg-hover/60 hover:text-fg"
        >
          <Plus className="size-3.5" /> Connect a sheet or API
        </button>
      </Section>

      {adding ? (
        <AddDataDialog
          serviceAccountEmail={serviceAccountEmail}
          initialTab={returned?.tab}
          oauthError={returned?.error}
          onClose={() => setAdding(false)}
          onCreated={(s) => {
            onChange([...sources, s].sort((a, b) => a.name.localeCompare(b.name)));
            setAdding(false);
            setViewing(s);
          }}
        />
      ) : null}
      {viewing ? (
        <SourceDialog
          source={viewing}
          onClose={() => setViewing(null)}
          onDeleted={(id) => {
            onChange(sources.filter((s) => s.id !== id));
            setViewing(null);
          }}
        />
      ) : null}
    </>
  );
}
