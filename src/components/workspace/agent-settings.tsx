"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { BookOpen, Check, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { Modal } from "@/components/data/data-dialog";
import type { Skill } from "@/lib/types";
import { useWorkspace } from "./workspace-context";

type Settings = {
  rules: string;
  skills: Skill[];
  builtins: { name: string; description: string }[];
  canEdit: boolean;
};

type Draft = { id?: string; name: string; description: string; body: string };

const MAX_RULES = 2000;

/** Team rules and skills for @tembak in this workspace. */
export function AgentSettingsDialog({ onClose }: { onClose: () => void }) {
  const { api } = useWorkspace();
  const [data, setData] = useState<Settings | null>(null);
  const [rules, setRules] = useState("");
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"rules" | "skill" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`${api}/agent`)
      .then((r) => (r.ok ? (r.json() as Promise<Settings>) : Promise.reject(new Error("Couldn't load agent settings"))))
      .then((d) => {
        if (!live) return;
        setData(d);
        setRules(d.rules);
      })
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [api]);

  async function saveRules() {
    setBusy("rules");
    setError(null);
    const res = await fetch(`${api}/agent`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rules }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) return setError("Couldn't save the rules");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function saveSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy("skill");
    setError(null);
    const res = await fetch(`${api}/agent/skills`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as Skill & { error?: string };
    setBusy(null);
    if (!res?.ok) return setError(body.error ?? "Couldn't save the skill");
    setData((d) => d && { ...d, skills: [...d.skills.filter((s) => s.id !== body.id), body].sort((a, b) => a.name.localeCompare(b.name)) });
    setDraft(null);
  }

  async function removeSkill(id: string) {
    const res = await fetch(`${api}/agent/skills/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) setData((d) => d && { ...d, skills: d.skills.filter((s) => s.id !== id) });
  }

  const editable = !!data?.canEdit;
  const input = "w-full rounded-lg border border-line-strong bg-raised px-3 text-sm outline-none transition placeholder:text-faint focus:border-accent";
  const overridden = new Set(data?.skills.map((s) => s.name));

  return (
    <Modal onClose={onClose} wide>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <h2 className="font-semibold">Agent settings</h2>
          <p className="mt-0.5 text-xs text-muted">How @tembak works in this workspace. Applies to everyone here.</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      {!data ? (
        <div className="p-8">{error ? <ErrorNote>{error}</ErrorNote> : <LoaderCircle className="mx-auto size-5 animate-spin text-faint" />}</div>
      ) : (
        <div className="space-y-6 p-5">
          {!editable ? (
            <p className="rounded-lg border border-line bg-bg px-3 py-2 text-xs text-muted">
              Only the demo&apos;s maintainers can change these. Create your own workspace to set your own rules.
            </p>
          ) : null}

          <section>
            <h3 className="text-sm font-semibold">Team rules</h3>
            <p className="mt-0.5 text-xs text-muted">Followed on every request: brand colors, tone, must-haves like a CSV export.</p>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value.slice(0, MAX_RULES))}
              readOnly={!editable}
              aria-label="Team rules"
              rows={4}
              placeholder={"Use our brand orange #ff5a1f as the accent.\nAlways add an Export CSV button.\nKeep the tone casual."}
              className={clsx(input, "mt-3 py-2.5 leading-relaxed")}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-faint">
              <span>
                {rules.length}/{MAX_RULES}
              </span>
              {editable ? (
                <button
                  onClick={saveRules}
                  disabled={busy !== null || rules === data.rules}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink hover:brightness-110 disabled:opacity-50"
                >
                  {busy === "rules" ? <LoaderCircle className="size-3.5 animate-spin" /> : saved ? <Check className="size-3.5" /> : null}
                  {saved ? "Saved" : "Save rules"}
                </button>
              ) : null}
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Skills</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Recipes @tembak uses when they fit. Only names are read up front; the full recipe loads when needed.
                </p>
              </div>
              {editable && !draft ? (
                <button
                  onClick={() => setDraft({ name: "", description: "", body: "" })}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-hover px-3 text-sm hover:bg-line-strong"
                >
                  <Plus className="size-3.5" /> New skill
                </button>
              ) : null}
            </div>

            {draft ? (
              <form onSubmit={saveSkill} className="mt-3 space-y-3 rounded-xl border border-line bg-bg p-4">
                <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                  <input
                    required
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="weekly-report"
                    aria-label="Skill name"
                    className={clsx(input, "h-9 font-mono")}
                  />
                  <input
                    required
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="When to use it, in one line"
                    aria-label="Description"
                    className={clsx(input, "h-9")}
                  />
                </div>
                <textarea
                  required
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value.slice(0, 4000) })}
                  rows={6}
                  placeholder="Layout, sections, metrics, interactions. Write it like a brief for a designer."
                  aria-label="Recipe"
                  className={clsx(input, "py-2.5 leading-relaxed")}
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setDraft(null)} className="h-8 rounded-lg px-3 text-sm text-muted hover:bg-hover hover:text-fg">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy !== null}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-ink hover:brightness-110 disabled:opacity-50"
                  >
                    {busy === "skill" ? <LoaderCircle className="size-3.5 animate-spin" /> : null} Save skill
                  </button>
                </div>
              </form>
            ) : null}

            <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
              {data.skills.map((s) => (
                <li key={s.id} className="flex items-start gap-3 px-3 py-2.5">
                  <BookOpen className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-fg">{s.name}</p>
                    <p className="truncate text-xs text-muted">{s.description}</p>
                  </div>
                  {editable ? (
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => setDraft({ id: s.id, name: s.name, description: s.description, body: s.body })}
                        className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg"
                        aria-label={`Edit ${s.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button onClick={() => removeSkill(s.id)} className="rounded-md p-1.5 text-faint hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${s.name}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
              {data.builtins
                .filter((b) => !overridden.has(b.name))
                .map((b) => (
                  <li key={b.name} className="flex items-start gap-3 px-3 py-2.5">
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-faint" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-muted">
                        {b.name} <span className="ml-1 font-sans text-[10px] uppercase tracking-wider text-faint">built-in</span>
                      </p>
                      <p className="truncate text-xs text-faint">{b.description}</p>
                    </div>
                  </li>
                ))}
            </ul>
          </section>

          {error ? <ErrorNote>{error}</ErrorNote> : null}
        </div>
      )}
    </Modal>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}
