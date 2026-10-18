"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, Bot, Plug } from "lucide-react";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import type { WorkspaceInfo } from "@/lib/types";

/** Add a section here and a page under /w/[slug]/settings to grow the settings. */
const SECTIONS = [
  { href: "agent", label: "Agent", Icon: Bot },
  { href: "connectors", label: "Connectors", Icon: Plug },
] as const;

/** Workspace settings: a docked section nav like the workspace sidebar (tabs on top on phones), the section filling the rest. */
export function SettingsShell({ workspace, children }: { workspace: WorkspaceInfo; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/w/${encodeURIComponent(workspace.slug)}`;

  return (
    <WorkspaceProvider workspace={workspace}>
      <div className="flex h-full flex-col overflow-hidden md:flex-row">
        <aside className="shrink-0 border-b border-line bg-panel md:flex md:h-full md:w-64 md:flex-col md:border-r md:border-b-0">
          <div className="flex h-14 items-center border-b border-line px-4">
            <Link href={base} className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
              <ArrowLeft className="size-3.5" /> Back to workspace
            </Link>
          </div>
          <div className="px-2 py-3 md:py-4">
            <p className="truncate px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{workspace.name} settings</p>
            <nav className="flex gap-1 overflow-x-auto md:flex-col">
              {SECTIONS.map(({ href, label, Icon }) => {
                const active = pathname.startsWith(`${base}/settings/${href}`);
                return (
                  <Link
                    key={href}
                    href={`${base}/settings/${href}`}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                      active ? "bg-hover text-fg" : "text-muted hover:bg-hover/60 hover:text-fg",
                    )}
                  >
                    <Icon className="size-3.5" /> {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="max-w-5xl px-4 py-6 md:pr-10 md:pl-16 md:py-10 lg:pl-20">{children}</div>
        </main>
      </div>
    </WorkspaceProvider>
  );
}

export function SettingsHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-8 border-b border-line pb-5">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </header>
  );
}
