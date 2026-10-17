"use client";

import { useState } from "react";
import { Database, FileSpreadsheet, Globe, Plus, Sparkle } from "lucide-react";
import { Section } from "@/components/workspace/sidebar";
import type { Source } from "@/lib/types";
import { AddDataDialog, SourceDialog } from "./data-dialog";

const ICONS = { sheet: FileSpreadsheet, csv: Database, json: Globe, sample: Sparkle };

export function DataSection({
  sources,
  serviceAccountEmail,
  onChange,
}: {
  sources: Source[];
  serviceAccountEmail?: string;
  onChange: (sources: Source[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Source | null>(null);

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
