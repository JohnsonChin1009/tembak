"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Hash, LogOut, Plus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { usePeople } from "@/components/people/people-context";
import type { Channel, User } from "@/lib/types";
import { useWorkspace } from "./workspace-context";
import { WorkspaceMenu, type WorkspaceLink } from "./workspace-menu";

export function Sidebar({
  user,
  workspaces,
  channels,
  channelId,
  onCreateChannel,
  children,
}: {
  user: User;
  workspaces: WorkspaceLink[];
  channels: Channel[];
  channelId: string;
  onCreateChannel: (name: string) => Promise<void>;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { base } = useWorkspace();
  const people = usePeople();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await onCreateChannel(name);
    setName("");
    setCreating(false);
  }

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-14 items-center border-b border-line px-2">
        <WorkspaceMenu workspaces={workspaces} />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
        <Section
          title="Channels"
          action={
            <button
              onClick={() => setCreating((v) => !v)}
              className="rounded p-1 text-faint hover:bg-hover hover:text-fg"
              aria-label="New channel"
            >
              <Plus className="size-3.5" />
            </button>
          }
        >
          {channels.map((c) => (
            <Link
              key={c.id}
              href={`${base}/c/${c.id}`}
              className={clsx(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                c.id === channelId ? "bg-hover text-fg" : "text-muted hover:bg-hover/60 hover:text-fg",
              )}
            >
              <Hash className="size-3.5 text-faint" />
              <span className="truncate">{c.name}</span>
            </Link>
          ))}
          {creating ? (
            <form onSubmit={submit} className="px-1 pt-1">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => !name && setCreating(false)}
                placeholder="new-channel"
                className="h-8 w-full rounded-md border border-line-strong bg-raised px-2 text-sm outline-none focus:border-accent"
              />
            </form>
          ) : null}
        </Section>
        {children}
      </nav>

      <div className="flex items-center gap-1 border-t border-line p-2">
        <button
          type="button"
          data-closes-nav
          onClick={() => people?.openSheet({ uid: user.uid, name: user.name, photoUrl: user.photoUrl })}
          title="Your profile"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left transition hover:bg-hover"
        >
          <Avatar name={user.name} seed={user.uid} photoUrl={user.photoUrl} className="size-7" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-faint">{user.title || user.email}</p>
          </div>
        </button>
        <button onClick={signOut} className="rounded p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Sign out">
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-2">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{title}</h3>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
