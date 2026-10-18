"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, ChevronRight, Eye, LoaderCircle, X } from "lucide-react";
import {
  ConnectedCard,
  ConnectForm,
  ErrorNote,
  MaintainersOnly,
  ProviderLogo,
  useConnections,
  type Brand,
  type ProviderState,
} from "@/components/data/connector-panel";
import { Modal } from "@/components/data/data-dialog";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { ConnectionProvider } from "@/lib/types";
import { SettingsHeader } from "./settings-shell";

const ABOUT: Record<ConnectionProvider, { tagline: string; description: string; reads: string[] }> = {
  notion: {
    tagline: "Docs, wikis, and databases",
    description: "Build apps on top of your Notion databases: content calendars, CRMs, trackers, and anything else kept in a table.",
    reads: ["Databases you share with Tembak", "Their rows and properties, up to 1,000 rows each"],
  },
  linear: {
    tagline: "Issue tracking for product teams",
    description: "Turn Linear into sprint boards, workload views, and status reports that stay up to date.",
    reads: ["Issues across all teams, or one team", "Projects, with their status and progress"],
  },
};

/** Shown after the live connectors, so people can see where this is going. */
const UPCOMING: { brand: Brand; label: string; tagline: string; description: string }[] = [
  {
    brand: "stripe",
    label: "Stripe",
    tagline: "Payments and subscriptions",
    description: "Daily sales boards, failed-payment follow-ups, and who churned this month.",
  },
  {
    brand: "hubspot",
    label: "HubSpot",
    tagline: "CRM for contacts and deals",
    description: "Pipeline boards and a list of who to follow up with today.",
  },
  {
    brand: "googlecalendar",
    label: "Google Calendar",
    tagline: "Bookings and schedules",
    description: "Staff rosters, booking trackers, and utilisation views from your calendars.",
  },
  {
    brand: "googledocs",
    label: "Google Docs",
    tagline: "Specs, briefs, and SOPs",
    description: "Point @tembak at a doc and have it build the tool the doc describes.",
  },
];

/** Connector directory: a card per app, details and the connect flow in a dialog. */
export function ConnectorSettings({ returned }: { returned: { provider: string; error: string | null } | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { state, error, reload } = useConnections();
  const [oauth] = useState(returned);
  // Back from OAuth: reopen that connector so the result (or error) shows in context.
  const [open, setOpen] = useState<ConnectionProvider | null>(
    returned?.provider === "notion" || returned?.provider === "linear" ? returned.provider : null,
  );

  // Drop the OAuth query params so a reload doesn't show the error again.
  useEffect(() => {
    if (returned) router.replace(pathname, { scroll: false });
    // Only once, on the return from the provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openInfo = state?.providers.find((p) => p.provider === open);

  return (
    <>
      <SettingsHeader
        title="Connectors"
        description="Let Tembak read from the tools your team already uses. Connections are shared with everyone in this workspace, and tokens stay on the server."
      />
      {!state ? (
        <div className="py-8">{error ? <ErrorNote>{error}</ErrorNote> : <LoaderCircle className="mx-auto size-5 animate-spin text-faint" />}</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.providers.map((info) => (
            <li key={info.provider}>
              <ConnectorCard info={info} onOpen={() => setOpen(info.provider)} />
            </li>
          ))}
          {UPCOMING.map((u) => (
            <li key={u.brand}>
              <Card brand={u.brand} label={u.label} tagline={u.tagline} description={u.description} badge={<SoonBadge />} />
            </li>
          ))}
        </ul>
      )}
      {state && openInfo ? (
        <ConnectorDialog
          info={openInfo}
          canConfigure={state.canConfigure}
          oauthError={oauth?.provider === openInfo.provider ? oauth.error : null}
          onChanged={reload}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function ConnectorCard({ info, onOpen }: { info: ProviderState; onOpen: () => void }) {
  const about = ABOUT[info.provider];
  // No OAuth app on the server and nothing connected yet: nothing to do here.
  const soon = !info.connection && !info.oauth;
  return (
    <Card
      brand={info.provider}
      label={info.label}
      tagline={about.tagline}
      description={about.description}
      onOpen={soon ? undefined : onOpen}
      badge={
        info.connection ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-dim px-2 py-0.5 text-[11px] font-medium text-accent">
            <Check className="size-3" /> Connected
          </span>
        ) : soon ? (
          <SoonBadge />
        ) : null
      }
      action={info.connection ? `Manage${info.connection.accountName ? ` · ${info.connection.accountName}` : ""}` : "Connect"}
    />
  );
}

/** Without `onOpen` the card is inert (coming soon). */
function Card({
  brand,
  label,
  tagline,
  description,
  badge,
  action,
  onOpen,
}: {
  brand: Brand;
  label: string;
  tagline: string;
  description: string;
  badge?: React.ReactNode;
  action?: string;
  onOpen?: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      disabled={!onOpen}
      className="group flex h-full w-full flex-col rounded-xl border border-line bg-panel p-4 text-left transition enabled:hover:border-line-strong enabled:hover:bg-raised disabled:cursor-default"
    >
      <div className="flex items-start justify-between gap-3">
        <ProviderLogo provider={brand} className={onOpen ? undefined : "opacity-60 grayscale-[35%]"} />
        {badge}
      </div>
      <h2 className={clsx("mt-4 text-sm font-semibold", !onOpen && "text-muted")}>{label}</h2>
      <p className="mt-0.5 text-xs text-faint">{tagline}</p>
      <p className={clsx("mt-2 line-clamp-3 flex-1 text-xs leading-relaxed", onOpen ? "text-muted" : "text-faint")}>{description}</p>
      {onOpen && action ? (
        <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-muted group-hover:text-fg">
          {action}
          <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />
        </span>
      ) : null}
    </button>
  );
}

function SoonBadge() {
  return <span className="shrink-0 rounded-full bg-hover px-2 py-0.5 text-[11px] font-medium text-faint">Coming soon</span>;
}

function ConnectorDialog({
  info,
  canConfigure,
  oauthError,
  onChanged,
  onClose,
}: {
  info: ProviderState;
  canConfigure: boolean;
  oauthError: string | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { api } = useWorkspace();
  const about = ABOUT[info.provider];
  return (
    <Modal onClose={onClose}>
      <div className="flex items-start gap-4 border-b border-line px-5 py-4">
        <ProviderLogo provider={info.provider} className="size-12" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{info.label}</h2>
          <p className="mt-0.5 text-xs text-muted">{about.tagline}</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="space-y-5 p-5">
        <p className="text-sm leading-relaxed text-muted">{about.description}</p>
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
            <Eye className="size-3" /> Read only. Tembak can see
          </h3>
          <ul className="space-y-1.5">
            {about.reads.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-3.5 shrink-0 text-accent" /> {r}
              </li>
            ))}
          </ul>
        </div>
        {info.connection ? (
          <>
            <ConnectedCard info={info} canConfigure={canConfigure} onDisconnected={onChanged} />
            <p className="text-xs text-muted">
              Pick what to use from <strong className="text-fg">Data → Add data → {info.label}</strong> in any channel.
            </p>
          </>
        ) : !canConfigure ? (
          <MaintainersOnly label={info.label} />
        ) : (
          <ConnectForm info={info} connectHref={`${api}/connect/${info.provider}?return=settings`} oauthError={oauthError} />
        )}
      </div>
    </Modal>
  );
}
