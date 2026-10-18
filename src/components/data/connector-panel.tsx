"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { Check, ExternalLink, KeyRound, LoaderCircle, Search, Unplug } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { ConnectionInfo, ConnectionProvider, LinearResource, SourceConfig } from "@/lib/types";

type ProviderState = { provider: ConnectionProvider; label: string; oauth: boolean; connection: ConnectionInfo | null };
type Database = { id: string; title: string; url?: string };
type Team = { id: string; key: string; name: string };

const HELP: Record<ConnectionProvider, { keyLabel: string; placeholder: string; steps: React.ReactNode }> = {
  notion: {
    keyLabel: "Internal integration secret",
    placeholder: "ntn_...",
    steps: (
      <>
        Create an internal integration at{" "}
        <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer" className="text-fg underline">
          notion.so/profile/integrations
        </a>
        , copy its secret, then in Notion open each database and use <strong className="text-fg">••• → Connections</strong> to add it.
      </>
    ),
  },
  linear: {
    keyLabel: "Personal API key",
    placeholder: "lin_api_...",
    steps: (
      <>
        In Linear, open <strong className="text-fg">Settings → Security &amp; access → Personal API keys</strong> and create a key with read
        access.
      </>
    ),
  },
};

const ERRORS: Record<string, string> = {
  denied: "The connection was cancelled.",
  failed: "Couldn't finish connecting. Try again, or use an API key instead.",
  not_configured: "OAuth isn't set up on this server. Use an API key instead.",
};

/**
 * Notion and Linear in the Add data dialog: connect (OAuth, or an API key as the
 * fallback), then pick a database or team. Reports the chosen config upward.
 */
export function ConnectorPanel({
  provider,
  oauthError,
  onConfig,
  onName,
}: {
  provider: ConnectionProvider;
  oauthError?: string | null;
  onConfig: (config: SourceConfig | null) => void;
  onName: (name: string) => void;
}) {
  const { api } = useWorkspace();
  const { channelId } = useParams<{ channelId?: string }>();
  const [state, setState] = useState<{ providers: ProviderState[]; canConfigure: boolean } | null>(null);
  const [error, setError] = useState<string | null>(oauthError ? (ERRORS[oauthError] ?? ERRORS.failed) : null);
  const [useKey, setUseKey] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(`${api}/connections`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load connections"))))
      .then((data) => live && setState(data))
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [api, reload]);

  const info = state?.providers.find((p) => p.provider === provider);
  const help = HELP[provider];

  // A button, not a form: this panel sits inside the Add data form.
  async function saveKey() {
    if (key.trim().length < 10) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`${api}/connections/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res?.ok) return setError(body.error ?? "Couldn't save that key");
    setKey("");
    setReload((n) => n + 1);
  }

  async function disconnect() {
    if (!confirm(`Disconnect ${info?.label}? Data sources that use it stop loading until you connect again.`)) return;
    await fetch(`${api}/connections/${provider}`, { method: "DELETE" });
    onConfig(null);
    setReload((n) => n + 1);
  }

  if (!state || !info) {
    return error ? <ErrorNote>{error}</ErrorNote> : <LoaderCircle className="mx-auto size-5 animate-spin text-faint" />;
  }

  if (info.connection) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-line bg-bg px-3 py-2.5">
          <span className="grid size-7 place-items-center rounded-md bg-accent-dim text-accent">
            <Check className="size-4" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate">
              Connected to <strong>{info.connection.accountName ?? info.label}</strong>
            </p>
            <p className="text-xs text-faint">{info.connection.authType === "oauth" ? "Signed in with " + info.label : "Using an API key"}</p>
          </div>
          {state.canConfigure ? (
            <button type="button" onClick={disconnect} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-faint hover:bg-hover hover:text-fg">
              <Unplug className="size-3.5" /> Disconnect
            </button>
          ) : null}
        </div>
        {provider === "notion" ? <NotionPicker onConfig={onConfig} onName={onName} /> : <LinearPicker onConfig={onConfig} onName={onName} />}
      </div>
    );
  }

  if (!state.canConfigure) {
    return <p className="rounded-lg border border-line bg-bg p-3 text-sm text-muted">Only the demo&apos;s maintainers can connect {info.label} here. Create your own workspace to connect yours.</p>;
  }

  const keyForm = (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-muted">{help.steps}</p>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            void saveKey();
          }}
          placeholder={help.placeholder}
          aria-label={help.keyLabel}
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-raised px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={saveKey}
          disabled={busy || key.trim().length < 10}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-hover px-3 text-sm font-medium hover:bg-line-strong disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Save key
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {info.oauth ? (
        <>
          <a
            href={`${api}/connect/${provider}${channelId ? `?channel=${encodeURIComponent(channelId)}` : ""}`}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-ink transition hover:brightness-110"
          >
            <ProviderMark provider={provider} /> Connect {info.label}
          </a>
          <p className="text-center text-xs text-faint">
            You&apos;ll pick what Tembak can read. It only reads; it never edits your {info.label}.
          </p>
          {useKey ? (
            keyForm
          ) : (
            <button type="button" onClick={() => setUseKey(true)} className="mx-auto block text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
              Use an API key instead
            </button>
          )}
        </>
      ) : (
        keyForm
      )}
    </div>
  );
}

function NotionPicker({ onConfig, onName }: { onConfig: (c: SourceConfig | null) => void; onName: (n: string) => void }) {
  const { api } = useWorkspace();
  const [dbs, setDbs] = useState<Database[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`${api}/connections/notion/targets`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Couldn't list databases");
        return body as { databases: Database[] };
      })
      .then((data) => live && setDbs(data.databases))
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [api]);

  const shown = useMemo(() => (dbs ?? []).filter((d) => d.title.toLowerCase().includes(q.toLowerCase())), [dbs, q]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!dbs) return <LoaderCircle className="mx-auto size-5 animate-spin text-faint" />;
  if (!dbs.length) {
    return (
      <p className="rounded-lg border border-line bg-bg p-3 text-sm text-muted">
        No databases shared yet. In Notion, open a database, then <strong className="text-fg">••• → Connections</strong> and add Tembak.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-muted">Database</span>
      {dbs.length > 6 ? (
        <label className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-raised px-3">
          <Search className="size-3.5 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search databases" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
      ) : null}
      <ul className="max-h-56 space-y-1 overflow-y-auto" role="listbox" aria-label="Notion databases">
        {shown.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              role="option"
              aria-selected={picked === d.id}
              onClick={() => {
                setPicked(d.id);
                onName(d.title);
                onConfig({ kind: "notion", dataSourceId: d.id, title: d.title });
              }}
              className={clsx(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                picked === d.id ? "border-accent bg-accent-dim" : "border-line hover:bg-hover",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{d.title}</span>
              {d.url ? (
                <a href={d.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-faint hover:text-fg" aria-label="Open in Notion">
                  <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinearPicker({ onConfig, onName }: { onConfig: (c: SourceConfig | null) => void; onName: (n: string) => void }) {
  const { api } = useWorkspace();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resource, setResource] = useState<LinearResource>("issues");
  const [teamKey, setTeamKey] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`${api}/connections/linear/targets`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Couldn't list teams");
        return body as { teams: Team[] };
      })
      .then((data) => {
        if (!live) return;
        setTeams(data.teams);
        // Issues across all teams is a sensible default before anything is clicked.
        onName("Linear issues");
        onConfig({ kind: "linear", resource: "issues" });
      })
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [api, onConfig, onName]);

  function choose(nextResource: LinearResource, nextTeam: string) {
    setResource(nextResource);
    setTeamKey(nextTeam);
    const team = teams?.find((t) => t.key === nextTeam);
    onName(nextResource === "projects" ? "Linear projects" : `Linear issues${team ? ` (${team.name})` : ""}`);
    onConfig({ kind: "linear", resource: nextResource, teamKey: nextResource === "issues" && nextTeam ? nextTeam : undefined });
  }

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!teams) return <LoaderCircle className="mx-auto size-5 animate-spin text-faint" />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-bg p-1">
        {(["issues", "projects"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => choose(r, teamKey)}
            className={clsx("rounded-lg py-1.5 text-xs font-medium capitalize transition", resource === r ? "bg-raised text-fg shadow-sm" : "text-faint hover:text-muted")}
          >
            {r}
          </button>
        ))}
      </div>
      {resource === "issues" ? (
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Team</span>
          <select
            value={teamKey}
            onChange={(e) => choose("issues", e.target.value)}
            className="h-10 w-full rounded-lg border border-line-strong bg-raised px-3 text-sm outline-none focus:border-accent"
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.key}>
                {t.name} ({t.key})
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

/** Small monochrome marks; not the providers' logos. */
export function ProviderMark({ provider, className }: { provider: ConnectionProvider; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "grid size-4 place-items-center rounded-[4px] border border-current text-[10px] leading-none font-bold",
        className,
      )}
    >
      {provider === "notion" ? "N" : "L"}
    </span>
  );
}
