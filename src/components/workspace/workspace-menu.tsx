"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Check, ChevronsUpDown, Copy, LoaderCircle, Plus, RotateCcw, Trash2, UserPlus, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/data/data-dialog";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import type { Member } from "@/lib/types";
import { AgentSettingsDialog } from "./agent-settings";
import { DeleteWorkspaceDialog } from "./manage-dialogs";
import { useWorkspace } from "./workspace-context";

export type WorkspaceLink = { slug: string; name: string };

/** Sidebar header: current workspace, switcher, invite, and (demo owners) reset. */
export function WorkspaceMenu({ workspaces }: { workspaces: WorkspaceLink[] }) {
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [settings, setSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted transition hover:bg-hover hover:text-fg";

  return (
    <div ref={ref} className="relative w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-hover"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-xs font-semibold text-accent-ink">
          {workspace.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold">{workspace.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-faint" />
      </button>

      {open ? (
        <div role="menu" className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-line-strong bg-raised p-1 shadow-xl shadow-black/50">
          <p className="px-2 pt-1 pb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">Workspaces</p>
          {workspaces.map((w) => (
            <Link key={w.slug} href={`/w/${w.slug}`} className={item} onClick={() => setOpen(false)}>
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.slug === workspace.slug ? <Check className="size-3.5 text-accent" /> : null}
            </Link>
          ))}
          <Link href="/new" className={item} onClick={() => setOpen(false)}>
            <Plus className="size-3.5" /> Create workspace
          </Link>
          <div className="my-1 h-px bg-line" />
          <button
            className={item}
            onClick={() => {
              setOpen(false);
              setInviting(true);
            }}
          >
            <UserPlus className="size-3.5" /> {workspace.open ? "Members" : "Invite people"}
          </button>
          <button
            className={item}
            onClick={() => {
              setOpen(false);
              setSettings(true);
            }}
          >
            <Bot className="size-3.5" /> Agent settings
          </button>
          {workspace.role === "owner" && !workspace.open ? (
            <>
              <div className="my-1 h-px bg-line" />
              <button
                className={`${item} hover:text-danger`}
                onClick={() => {
                  setOpen(false);
                  setDeleting(true);
                }}
              >
                <Trash2 className="size-3.5" /> Delete workspace
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}
      {settings ? <AgentSettingsDialog onClose={() => setSettings(false)} /> : null}
      {deleting ? <DeleteWorkspaceDialog onClose={() => setDeleting(false)} /> : null}
    </div>
  );
}

type Info = { inviteUrl: string | null; canReset: boolean; members: Member[] };

export function InviteDialog({ onClose }: { onClose: () => void }) {
  const { workspace, api, base } = useWorkspace();
  const onboarding = useOnboarding();
  const [info, setInfo] = useState<Info | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"rotate" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(api)
      .then((r) => (r.ok ? (r.json() as Promise<Info>) : Promise.reject(new Error("Couldn't load members"))))
      .then((data) => live && setInfo(data))
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [api]);

  async function copy() {
    if (!info?.inviteUrl) return;
    await navigator.clipboard.writeText(info.inviteUrl).catch(() => {});
    onboarding?.record("invite");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function rotate() {
    setBusy("rotate");
    setError(null);
    const res = await fetch(`${api}/invite`, { method: "POST" }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { inviteUrl?: string; error?: string };
    setBusy(null);
    if (!res?.ok || !data.inviteUrl) return setError(data.error ?? "Couldn't reset the link");
    setInfo((i) => (i ? { ...i, inviteUrl: data.inviteUrl! } : i));
  }

  async function reset() {
    if (!confirm("Delete everything people built in the demo and restore the original content?")) return;
    setBusy("reset");
    setError(null);
    const res = await fetch(`${api}/reset`, { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setBusy(null);
      return setError("Couldn't reset the demo");
    }
    window.location.assign(base);
  }

  const owner = workspace.role === "owner";

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="font-semibold">{workspace.open ? workspace.name : `Invite people to ${workspace.name}`}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {workspace.open
              ? "Anyone who signs in can join this workspace."
              : "Anyone with the link can join after signing in."}
          </p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        {info?.inviteUrl ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                readOnly
                value={info.inviteUrl}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Invite link"
                className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-bg px-3 font-mono text-xs text-muted outline-none"
              />
              <button
                onClick={copy}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink hover:brightness-110"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {owner ? (
              <button
                onClick={rotate}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-xs text-faint hover:text-fg disabled:opacity-50"
              >
                {busy === "rotate" ? <LoaderCircle className="size-3 animate-spin" /> : <RotateCcw className="size-3" />}
                Reset link (old links stop working)
              </button>
            ) : null}
          </div>
        ) : null}

        <div>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
            Members{info ? ` · ${info.members.length}` : ""}
          </h3>
          {!info && !error ? <LoaderCircle className="size-4 animate-spin text-faint" /> : null}
          {info && info.members.length === 1 && !workspace.open ? (
            <p className="mb-2 text-sm text-muted">It&apos;s just you so far. Tembak works best with your team.</p>
          ) : null}
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {info?.members.map((m) => (
              <li key={m.uid} className="flex items-center gap-3 rounded-md px-1 py-1">
                <Avatar name={m.name} seed={m.uid} photoUrl={m.photoUrl} className="size-7" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{m.name}</p>
                  {m.email ? <p className="truncate text-xs text-faint">{m.email}</p> : null}
                </div>
                {m.role === "owner" ? <span className="text-xs text-faint">Owner</span> : null}
              </li>
            ))}
          </ul>
        </div>

        {info?.canReset ? (
          <div className="rounded-lg border border-danger/30 p-3">
            <p className="text-sm font-medium">Reset demo</p>
            <p className="mt-0.5 text-xs text-muted">Deletes visitors&apos; messages, data, and apps, then restores the curated demo.</p>
            <button
              onClick={reset}
              disabled={busy !== null}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              {busy === "reset" ? <LoaderCircle className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              Reset demo
            </button>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
