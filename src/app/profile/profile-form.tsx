"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageUp, LoaderCircle, Trash2, Undo2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { AVATAR_SIZE, NAME_MAX, TITLE_MAX } from "@/lib/profile";
import type { User } from "@/lib/types";

/** "account" restores the sign-in photo, "none" shows initials, a data URL uploads. */
type PhotoChange = "account" | "none" | string;

/** Center-crops and shrinks the picture in the browser so uploads stay small. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

const input =
  "h-11 w-full rounded-lg border border-line-strong bg-raised px-3 text-fg outline-none transition placeholder:text-faint focus:border-accent";
const ghost =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted transition hover:bg-hover hover:text-fg disabled:opacity-50";

export function ProfileForm({
  user,
  accountPhotoUrl,
  usingAccountPhoto,
}: {
  user: User;
  /** The photo from Google sign-in, if any. */
  accountPhotoUrl?: string;
  usingAccountPhoto: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [title, setTitle] = useState(user.title ?? "");
  const [photo, setPhoto] = useState<PhotoChange | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview =
    photo === null ? user.photoUrl : photo === "account" ? accountPhotoUrl : photo === "none" ? undefined : photo;
  const onAccountPhoto = photo === "account" || (photo === null && usingAccountPhoto);
  const dirty = photo !== null || name.trim() !== user.name || title.trim() !== (user.title ?? "");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      setPhoto(await toAvatarDataUrl(file));
      setSaved(false);
    } catch {
      setError("Couldn't read that image. Try a JPEG or PNG.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, title, photo: photo ?? undefined }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res?.ok) return setError(data.error ?? "Couldn't save your profile");
    setPhoto(null);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={name || user.name} seed={user.uid} photoUrl={preview} className="size-20 rounded-2xl! text-2xl!" />
        <div className="flex flex-col items-start gap-0.5">
          <button type="button" onClick={() => fileRef.current?.click()} className={ghost}>
            <ImageUp className="size-3.5" /> Upload picture
          </button>
          {preview ? (
            <button type="button" onClick={() => setPhoto("none")} className={ghost}>
              <Trash2 className="size-3.5" /> Remove
            </button>
          ) : null}
          {accountPhotoUrl && !onAccountPhoto ? (
            <button type="button" onClick={() => setPhoto("account")} className={ghost}>
              <Undo2 className="size-3.5" /> Use Google photo
            </button>
          ) : null}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted" htmlFor="profile-name">
          Name
        </label>
        <input
          id="profile-name"
          required
          maxLength={NAME_MAX}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          className={input}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-muted" htmlFor="profile-title">
          Title <span className="font-normal text-faint">(optional)</span>
        </label>
        <input
          id="profile-title"
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
          placeholder="Product designer"
          className={input}
        />
      </div>

      {user.email ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted">Email</p>
          <p className="text-sm text-faint">{user.email} · from your Google account</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy || !dirty || !name.trim()}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent font-medium text-accent-ink transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : saved && !dirty ? <Check className="size-4" /> : null}
        {saved && !dirty ? "Saved" : "Save profile"}
      </button>
      {error ? (
        <p role="alert" className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
