"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { Modal } from "@/components/data/data-dialog";
import { channelNameDraft } from "@/lib/ids";
import type { Channel } from "@/lib/types";
import { useWorkspace } from "./workspace-context";

const input =
  "h-10 w-full rounded-lg border border-line-strong bg-bg px-3 text-sm outline-none transition focus:border-accent";

function Header({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-5 py-4">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close">
        <X className="size-4" />
      </button>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {error}
    </p>
  );
}

/** Rename a channel and edit its topic. The URL keeps the original id. */
export function ChannelSettingsDialog({
  channel,
  onSaved,
  onClose,
}: {
  channel: Channel;
  onSaved: (channel: Channel) => void;
  onClose: () => void;
}) {
  const { api } = useWorkspace();
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`${api}/channels/${encodeURIComponent(channel.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, topic }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as Channel & { error?: string };
    setBusy(false);
    if (!res?.ok) return setError(data.error ?? "Couldn't save the channel");
    onSaved(data);
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <Header title="Channel settings" onClose={onClose} />
      <form onSubmit={save} className="space-y-4 p-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Name</span>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-faint">#</span>
            <input
              autoFocus
              value={name}
              maxLength={32}
              onChange={(e) => setName(channelNameDraft(e.target.value))}
              className={`${input} pl-7`}
            />
          </div>
          <span className="block text-xs text-faint">Lowercase, dashes for spaces. Links to this channel keep working.</span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Topic</span>
          <input
            value={topic}
            maxLength={200}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What this channel is for"
            className={input}
          />
        </label>
        <ErrorLine error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-muted hover:bg-hover hover:text-fg">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-ink hover:brightness-110 disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Owner-only. Requires typing the workspace name, then sends everyone home. */
export function DeleteWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const { workspace, api } = useWorkspace();
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = confirm.trim() === workspace.name;

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    setError(null);
    const res = await fetch(api, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm }),
    }).catch(() => null);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => ({}))) as { error?: string };
      setBusy(false);
      return setError(data.error ?? "Couldn't delete the workspace");
    }
    // "/" sends members to their next workspace, or to /new if this was their last.
    router.replace("/");
    router.refresh();
  }

  return (
    <Modal onClose={onClose}>
      <Header title={`Delete ${workspace.name}`} subtitle="This can't be undone." onClose={onClose} />
      <form onSubmit={remove} className="space-y-4 p-5">
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-muted">
          Deletes every channel, message, data source, connection, and app in this workspace for all members.
          <strong className="font-medium text-fg"> Published app links stop working.</strong>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm">
            Type <strong className="font-medium text-fg">{workspace.name}</strong> to confirm
          </span>
          <input autoFocus value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
        </label>
        <ErrorLine error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-muted hover:bg-hover hover:text-fg">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || !matches}
            className="inline-flex items-center gap-1.5 rounded-md bg-danger px-3 py-2 text-sm font-medium text-bg hover:brightness-110 disabled:opacity-40"
          >
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            Delete workspace
          </button>
        </div>
      </form>
    </Modal>
  );
}
