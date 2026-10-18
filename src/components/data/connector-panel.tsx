"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { Check, ExternalLink, LoaderCircle, Search, Unplug } from "lucide-react";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { ConnectionInfo, ConnectionProvider, LinearResource, SourceConfig } from "@/lib/types";

export type ProviderState = { provider: ConnectionProvider; label: string; oauth: boolean; connection: ConnectionInfo | null };
type Database = { id: string; title: string; url?: string };
type Team = { id: string; key: string; name: string };

const ERRORS: Record<string, string> = {
  denied: "The connection was cancelled.",
  failed: "Couldn't finish connecting. Try again.",
  not_configured: "This connector isn't available yet.",
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
  const { state, error, reload } = useConnections();

  const info = state?.providers.find((p) => p.provider === provider);

  if (!state || !info) {
    return error ? <ErrorNote>{error}</ErrorNote> : <LoaderCircle className="mx-auto size-5 animate-spin text-faint" />;
  }

  if (info.connection) {
    return (
      <div className="space-y-4">
        <ConnectedCard
          info={info}
          canConfigure={state.canConfigure}
          onDisconnected={() => {
            onConfig(null);
            reload();
          }}
        />
        {provider === "notion" ? <NotionPicker onConfig={onConfig} onName={onName} /> : <LinearPicker onConfig={onConfig} onName={onName} />}
      </div>
    );
  }

  if (!state.canConfigure) return <MaintainersOnly label={info.label} />;

  return (
    <ConnectForm
      info={info}
      connectHref={`${api}/connect/${provider}${channelId ? `?channel=${encodeURIComponent(channelId)}` : ""}`}
      oauthError={oauthError}
    />
  );
}

/** Workspace connections (no tokens), refetched after connecting or disconnecting. */
export function useConnections() {
  const { api } = useWorkspace();
  const [state, setState] = useState<{ providers: ProviderState[]; canConfigure: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(`${api}/connections`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Couldn't load connections"))))
      .then((data) => live && setState(data))
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [api, version]);

  const reload = useCallback(() => setVersion((n) => n + 1), []);
  return { state, error, reload };
}

export function MaintainersOnly({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-line bg-bg p-3 text-sm text-muted">
      Only the demo&apos;s maintainers can connect {label} here. Create your own workspace to connect yours.
    </p>
  );
}

export function ConnectedCard({
  info,
  canConfigure,
  onDisconnected,
}: {
  info: ProviderState;
  canConfigure: boolean;
  onDisconnected: () => void;
}) {
  const { api } = useWorkspace();
  if (!info.connection) return null;

  async function disconnect() {
    if (!confirm(`Disconnect ${info.label}? Data sources that use it stop loading until you connect again.`)) return;
    await fetch(`${api}/connections/${info.provider}`, { method: "DELETE" });
    onDisconnected();
  }

  return (
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
      {canConfigure ? (
        <button type="button" onClick={disconnect} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-faint hover:bg-hover hover:text-fg">
          <Unplug className="size-3.5" /> Disconnect
        </button>
      ) : null}
    </div>
  );
}

/** One-click OAuth. Without an OAuth app on the server the connector shows as coming soon. */
export function ConnectForm({
  info,
  connectHref,
  oauthError,
}: {
  info: ProviderState;
  connectHref: string;
  oauthError?: string | null;
}) {
  const error = oauthError ? (ERRORS[oauthError] ?? ERRORS.failed) : null;
  if (!info.oauth) return <ComingSoon label={info.label} />;
  return (
    <div className="space-y-3">
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <a
        href={connectHref}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-ink transition hover:brightness-110"
      >
        <ProviderMark provider={info.provider} /> Connect {info.label}
      </a>
      <p className="text-center text-xs text-faint">
        You&apos;ll pick what Tembak can read. It only reads; it never edits your {info.label}.
      </p>
    </div>
  );
}

export function ComingSoon({ label }: { label: string }) {
  return <p className="rounded-lg border border-line bg-bg p-3 text-sm text-muted">{label} is coming soon.</p>;
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

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

/** Connectors plus the ones listed as coming soon. */
export type Brand = ConnectionProvider | "googledocs" | "googlecalendar" | "stripe" | "hubspot";

// Glyphs from Simple Icons (CC0), 24x24.
const GLYPHS: Record<Brand, string> = {
  notion:
    "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z",
  linear:
    "M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z",
  googledocs:
    "M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zm-.545 10.455H7.09v-1.364h7.09v1.364zm2.727-3.273H7.091v-1.364h9.818v1.364zm0-3.273H7.091V9.273h9.818v1.363zM14.727 6h6l-6-6v6z",
  googlecalendar:
    "M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.207 6.25v-.065c.272-.144.5-.349.687-.617s.279-.595.279-.982c0-.379-.099-.72-.3-1.025a2.05 2.05 0 0 0-.832-.714 2.703 2.703 0 0 0-1.197-.257c-.6 0-1.094.156-1.481.467-.386.311-.65.671-.793 1.078l1.085.452c.086-.249.224-.461.413-.633.189-.172.445-.257.767-.257.33 0 .602.088.816.264a.86.86 0 0 1 .322.703c0 .33-.12.589-.36.778-.24.19-.535.284-.886.284h-.567v1.085h.633c.407 0 .748.109 1.02.327.272.218.407.499.407.843 0 .336-.129.614-.387.832s-.565.327-.924.327c-.351 0-.651-.103-.897-.311-.248-.208-.422-.502-.521-.881l-1.096.452c.178.616.505 1.082.977 1.401.472.319.984.478 1.538.477a2.84 2.84 0 0 0 1.293-.291c.382-.193.684-.458.902-.794.218-.336.327-.72.327-1.149 0-.429-.115-.797-.344-1.105a2.067 2.067 0 0 0-.881-.689zm2.093-1.931l.602.913L15 10.045v5.744h1.187V8.446h-.827l-2.158 1.557zM22.105 0h-3.289v5.184H24V1.895A1.894 1.894 0 0 0 22.105 0zm-3.289 23.5l4.684-4.684h-4.684V23.5zM0 22.105C0 23.152.848 24 1.895 24h3.289v-5.184H0v3.289z",
  stripe:
    "M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z",
  hubspot:
    "M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z",
};

// Brand colors from Simple Icons.
const TILES: Record<Brand, string> = {
  notion: "bg-white text-black ring-1 ring-black/10",
  linear: "bg-[#5e6ad2] text-white",
  googledocs: "bg-[#4285f4] text-white",
  googlecalendar: "bg-[#4285f4] text-white",
  stripe: "bg-[#635bff] text-white",
  hubspot: "bg-[#ff7a59] text-white",
};

/** The brand's logo in the current text color, for inline use. */
export function ProviderMark({ provider, className }: { provider: Brand; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden fill="currentColor" className={clsx("size-4 shrink-0", className)}>
      <path d={GLYPHS[provider]} />
    </svg>
  );
}

/** The logo on its brand-colored tile, for connector cards. */
export function ProviderLogo({ provider, className }: { provider: Brand; className?: string }) {
  return (
    <span aria-hidden className={clsx("grid size-10 shrink-0 place-items-center rounded-xl", TILES[provider], className)}>
      <ProviderMark provider={provider} className="size-[55%]" />
    </span>
  );
}
