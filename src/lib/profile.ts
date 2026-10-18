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
