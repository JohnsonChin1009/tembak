// Profile limits and helpers. Safe to import from client and server.
import type { Profile, User } from "@/lib/types";

export const NAME_MAX = 40;
export const TITLE_MAX = 60;
/** Square edge the browser resizes uploads to before sending. */
export const AVATAR_SIZE = 256;
/** Upper bound on the uploaded data URL, well under Firestore's 1 MB document limit. */
export const AVATAR_MAX_CHARS = 400_000;

export const avatarUrl = (uid: string, updatedAt: number) => `/api/avatars/${encodeURIComponent(uid)}?v=${updatedAt}`;

/** The user as others see them: sign-in identity with profile edits on top. Drops `profile` itself. */
export function applyProfile(user: User, profile: Profile | undefined): User {
  const base = { ...user };
  delete base.profile;
  if (!profile) return base;
  return {
    ...base,
    name: profile.name || base.name,
    title: profile.title || undefined,
    photoUrl: profile.photoUrl === undefined ? base.photoUrl : profile.photoUrl || undefined,
  };
}

/** Browser only: center-crops and shrinks the picture so uploads stay small. */
export async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
