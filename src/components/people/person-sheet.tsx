"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Calendar, ImageUp, LoaderCircle, Mail, Pencil, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { NAME_MAX, TITLE_MAX, toAvatarDataUrl } from "@/lib/profile";
import { usePeople, usePerson, type PersonFallback } from "./people-context";

const dateFmt = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" });

type ProfilePatch = { name?: string; title?: string; photo?: string };

/**
 * Docked side panel (full screen on phones) with who someone is: picture, name, title,
 * contact, and role here. On your own profile, the name, title, and photo edit in place.
 */
export function PersonSheet({ person, onClose }: { person: PersonFallback; onClose: () => void }) {
  const router = useRouter();
  const people = usePeople();
  const current = usePerson(person);
  const member = people?.get(person.uid);
  const isMe = people?.me.uid === person.uid;
  const fileRef = useRef<HTMLInputElement>(null);
  // Edits show right away; the refreshed user from the server replaces them.
  const [shown, setShown] = useState<{ name?: string; title?: string; photoUrl?: string }>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = shown.name ?? current.name;
  const title = shown.title ?? current.title;
  const photoUrl = shown.photoUrl ?? current.photoUrl;

  useEffect(() => {
    people?.load(person.uid);
  }, [people, person.uid]);

  useEffect(() => {
    // Inline editors cancel on Escape and mark it handled, so only a bare Escape closes the panel.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(patch: ProfilePatch) {
    setError(null);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    if (!res?.ok) {
      setError(data.error ?? "Couldn't save your profile");
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveText(field: "name" | "title", value: string) {
    const before = shown[field];
    setShown((s) => ({ ...s, [field]: value }));
    if (!(await save({ [field]: value }))) setShown((s) => ({ ...s, [field]: before }));
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let photo: string;
    try {
      photo = await toAvatarDataUrl(file);
    } catch {
      return setError("Couldn't read that image. Try a JPEG or PNG.");
    }
    const before = shown.photoUrl;
    setShown((s) => ({ ...s, photoUrl: photo }));
    setUploading(true);
    if (!(await save({ photo }))) setShown((s) => ({ ...s, photoUrl: before }));
    setUploading(false);
  }

  const avatar = <Avatar name={name} seed={person.uid} photoUrl={photoUrl} className="size-40 rounded-2xl! text-5xl!" />;

  return (
    <aside
      aria-label={`${name}'s profile`}
      className="sheet-in fixed inset-0 z-40 flex flex-col bg-panel md:static md:z-auto md:w-80 md:shrink-0 md:border-l md:border-line lg:w-96"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
        <h2 className="text-sm font-semibold">Profile</h2>
        <button onClick={onClose} className="rounded-md p-1.5 text-faint hover:bg-hover hover:text-fg" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isMe ? (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Change profile photo"
              className="group relative block rounded-2xl"
            >
              {avatar}
              <span
                className={clsx(
                  "absolute inset-0 flex items-center justify-center gap-1.5 rounded-2xl bg-black/55 text-sm font-medium text-white transition",
                  uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                )}
              >
                {uploading ? <LoaderCircle className="size-5 animate-spin" /> : <><ImageUp className="size-4" /> Change photo</>}
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickPhoto} />
            <EditableText
              label="name"
              value={name}
              required
              maxLength={NAME_MAX}
              onSave={(v) => saveText("name", v)}
              className="mt-5 text-xl font-semibold tracking-tight"
            />
            <EditableText
              label="title"
              value={title ?? ""}
              placeholder="Add a title"
              maxLength={TITLE_MAX}
              onSave={(v) => saveText("title", v)}
              className="mt-0.5 text-muted"
            />
            {error ? (
              <p role="alert" className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
          </>
        ) : (
          <>
            {avatar}
            <h3 className="mt-5 text-xl font-semibold tracking-tight">{name}</h3>
            {title ? <p className="mt-0.5 text-muted">{title}</p> : null}
          </>
        )}
        {member?.role === "owner" ? (
          <span className="mt-2 inline-block rounded bg-accent-dim px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
            Owner
          </span>
        ) : null}

        <dl className="mt-6 space-y-4 border-t border-line pt-5 text-sm">
          {member?.email ? (
            <Detail icon={Mail} label="Email">
              <a href={`mailto:${member.email}`} className="break-all text-fg hover:text-accent">
                {member.email}
              </a>
            </Detail>
          ) : null}
          {member?.joinedAt ? (
            <Detail icon={Calendar} label="Joined">
              {dateFmt.format(member.joinedAt)}
            </Detail>
          ) : null}
          {member === null ? <p className="text-muted">Not a member of this workspace.</p> : null}
          {member === undefined ? <div className="h-10 animate-pulse rounded-lg bg-raised" /> : null}
        </dl>
      </div>
    </aside>
  );
}

/** Text that turns into an input on click. Enter or blur saves, Escape cancels. */
function EditableText({
  label,
  value,
  placeholder,
  required,
  maxLength,
  onSave,
  className,
}: {
  label: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  maxLength: number;
  onSave: (value: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false);

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => {
          cancelled.current = false;
          setDraft(value);
        }}
        title={`Edit ${label}`}
        className={clsx(
          "group -mx-1.5 flex max-w-[calc(100%+0.75rem)] items-center gap-1.5 rounded-md px-1.5 text-left transition hover:bg-hover",
          className,
        )}
      >
        <span className={clsx("min-w-0 break-words", !value && "text-faint")}>{value || placeholder}</span>
        <Pencil className="size-3.5 shrink-0 text-faint opacity-0 transition group-hover:opacity-100" />
      </button>
    );
  }

  function commit() {
    const next = draft!.trim();
    setDraft(null);
    if (cancelled.current || next === value || (required && !next)) return;
    onSave(next);
  }

  return (
    <input
      autoFocus
      aria-label={`Your ${label}`}
      value={draft}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.preventDefault();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      className={clsx(
        "-mx-1.5 block w-[calc(100%+0.75rem)] rounded-md border border-accent bg-raised px-1.5 text-fg outline-none placeholder:text-faint",
        className,
      )}
    />
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-faint" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{label}</dt>
        <dd className="mt-0.5">{children}</dd>
      </div>
    </div>
  );
}
