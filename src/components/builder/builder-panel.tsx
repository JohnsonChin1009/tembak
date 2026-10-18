"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Code2, Eye, Monitor, Smartphone, X } from "lucide-react";
import { Composer } from "@/components/chat/composer";
import { injectRuntime } from "@/lib/runtime";
import type { App, AppVersion, AppVersionMeta } from "@/lib/types";
import { CodeView } from "./code-view";

const versionCache = new Map<string, AppVersion>();

async function fetchVersion(appId: string, n: number): Promise<AppVersion> {
  const key = `${appId}:${n}`;
  const hit = versionCache.get(key);
  if (hit) return hit;
  const res = await fetch(`/api/apps/${appId}/versions/${n}`);
  if (!res.ok) throw new Error("Couldn't load this version");
  const v = (await res.json()) as AppVersion;
  versionCache.set(key, v);
  return v;
}

/** The member's runtime token for this app, refreshed a few minutes before it expires. */
function useAppToken(appId: string): string | null {
  const [token, setToken] = useState<{ appId: string; value: string } | null>(null);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      fetch(`/api/apps/${appId}/token`, { method: "POST" })
        .then((r) => (r.ok ? (r.json() as Promise<{ token: string; expiresAt: number }>) : null))
        .then((d) => {
          if (!live || !d) return;
          setToken({ appId, value: d.token });
          timer = setTimeout(load, Math.max(60_000, d.expiresAt - Date.now() - 5 * 60_000));
        });
    load();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [appId]);
  return token?.appId === appId ? token.value : null;
}

export function BuilderPanel({
  app,
  version,
  appsUrl,
  building,
  actions,
  onSelectVersion,
  onClose,
  onRequestChanges,
}: {
  app: App;
  version: number;
  appsUrl: string;
  /** Status line while the agent is revising this app. */
  building: string | null;
  /** Extra header actions (publish, share). */
  actions?: React.ReactNode;
  onSelectVersion: (n: number) => void;
  onClose: () => void;
  onRequestChanges: (text: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [loaded, setLoaded] = useState<AppVersion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<AppVersionMeta[]>([]);

  useEffect(() => {
    let live = true;
    fetchVersion(app.id, version).then(
      (v) => live && (setLoaded(v), setError(null)),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [app.id, version]);

  useEffect(() => {
    let live = true;
    fetch(`/api/apps/${app.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { versions: AppVersionMeta[] } | null) => live && d && setVersions(d.versions));
    return () => {
      live = false;
    };
  }, [app.id, app.latestVersion]);

  const token = useAppToken(app.id);
  const current = loaded?.appId === app.id && loaded.n === version && token ? loaded : null;
  const srcDoc = useMemo(
    () => (current && token ? injectRuntime(current.html, { appId: app.id, version, apiBase: appsUrl, token }) : ""),
    [current, app.id, version, appsUrl, token],
  );
  const meta = versions.find((v) => v.n === version);

  return (
    <section className="flex h-full min-w-0 flex-col bg-panel">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-semibold">{app.title}</h2>
            <VersionPicker app={app} version={version} versions={versions} onSelect={onSelectVersion} />
            {app.publishedVersion === version ? (
              <span className="flex items-center gap-1 rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-medium text-accent">
                <span className="size-1.5 rounded-full bg-accent" /> Live
              </span>
            ) : (
              <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-faint">Draft</span>
            )}
          </div>
        </div>
        {actions}
        <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close panel">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex h-11 shrink-0 items-center justify-between border-b border-line px-3">
        <div className="flex rounded-lg bg-bg p-0.5">
          <TabButton active={tab === "preview"} onClick={() => setTab("preview")} icon={<Eye className="size-3.5" />}>
            Preview
          </TabButton>
          <TabButton active={tab === "code"} onClick={() => setTab("code")} icon={<Code2 className="size-3.5" />}>
            Code
          </TabButton>
        </div>
        {tab === "preview" ? (
          <div className="flex rounded-lg bg-bg p-0.5">
            <TabButton active={device === "desktop"} onClick={() => setDevice("desktop")} icon={<Monitor className="size-3.5" />} label="Desktop" />
            <TabButton active={device === "mobile"} onClick={() => setDevice("mobile")} icon={<Smartphone className="size-3.5" />} label="Mobile" />
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 bg-bg">
        {error ? (
          <div className="grid h-full place-items-center text-sm text-danger">{error}</div>
        ) : !current ? (
          <div className="grid h-full place-items-center">
            <span className="sheen text-sm">Loading preview...</span>
          </div>
        ) : tab === "code" ? (
          <CodeView code={current.html} />
        ) : (
          <div className={clsx("h-full", device === "mobile" && "grid place-items-center overflow-auto p-6")}>
            <iframe
              key={`${app.id}-${version}`}
              title={`${app.title} preview`}
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-forms allow-popups allow-modals allow-downloads"
              className={clsx(
                "bg-white",
                device === "desktop"
                  ? "h-full w-full"
                  : "h-[780px] max-h-full w-[390px] rounded-[28px] border-[6px] border-line-strong shadow-2xl",
              )}
            />
          </div>
        )}
        {building ? (
          <div className="absolute inset-0 grid place-items-center bg-bg/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-xl border border-line-strong bg-raised px-4 py-3 shadow-2xl">
              <span className="dot-pulse flex gap-0.5" aria-hidden>
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="size-1.5 rounded-full bg-accent" />
              </span>
              <span className="sheen text-sm font-medium">{building}</span>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-line p-3">
        {meta?.summary ? <p className="mb-2 line-clamp-2 px-1 text-xs text-muted">{meta.summary}</p> : null}
        <Composer
          compact
          placeholder={`Ask Tembak to change ${app.title}...`}
          disabled={!!building}
          onSend={onRequestChanges}
        />
      </footer>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={clsx(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
        active ? "bg-raised text-fg shadow-sm" : "text-faint hover:text-muted",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function VersionPicker({
  app,
  version,
  versions,
  onSelect,
}: {
  app: App;
  version: number;
  versions: AppVersionMeta[];
  onSelect: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const list = versions.length ? [...versions].reverse() : [{ n: app.latestVersion, summary: "" } as AppVersionMeta];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-1 rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-muted hover:text-fg"
      >
        v{version}
        <ChevronDown className="size-3" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-80 w-72 overflow-auto rounded-xl border border-line-strong bg-raised p-1 shadow-2xl shadow-black/50">
          {list.map((v) => (
            <button
              key={v.n}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(v.n);
                setOpen(false);
              }}
              className={clsx(
                "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-hover",
                v.n === version && "bg-hover",
              )}
            >
              <span className="mt-px font-mono text-xs text-accent">v{v.n}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-xs text-muted">{v.summary || "Initial version"}</span>
                {app.publishedVersion === v.n ? <span className="text-[10px] font-medium text-accent">LIVE</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
