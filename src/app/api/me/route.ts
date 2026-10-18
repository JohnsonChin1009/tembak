import { z } from "zod";
import { handle, HttpError, json, parseBody } from "@/lib/api";
import { forgetProfile, getSessionAccount } from "@/lib/auth/session";
import { applyProfile, AVATAR_MAX_CHARS, avatarUrl, NAME_MAX, TITLE_MAX } from "@/lib/profile";
import { getStore } from "@/lib/store";
import type { Profile } from "@/lib/types";

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;

/**
 * Updates the signed-in user's profile. `photo` is a data URL to upload,
 * "none" to show initials, or "account" to go back to the sign-in photo.
 */
export const PATCH = handle(async (req: Request) => {
  const session = await getSessionAccount();
  if (!session) throw new HttpError(401, "Sign in required");
  const body = await parseBody(
    req,
    z.object({
      name: z.string().trim().min(1, "Enter a name").max(NAME_MAX).optional(),
      title: z.string().trim().max(TITLE_MAX).optional(),
      photo: z.string().max(AVATAR_MAX_CHARS, "That picture is too large").optional(),
    }),
  );

  const { account } = session;
  const store = await getStore();
  const profile: Profile = { ...session.profile };
  if (body.name !== undefined) profile.name = body.name === account.name ? undefined : body.name;
  if (body.title !== undefined) profile.title = body.title || undefined;
  if (body.photo === "account") {
    delete profile.photoUrl;
    await store.setAvatar(account.uid, null);
  } else if (body.photo === "none") {
    profile.photoUrl = "";
    await store.setAvatar(account.uid, null);
  } else if (body.photo !== undefined) {
    const match = DATA_URL.exec(body.photo);
    if (!match) throw new HttpError(400, "Use a JPEG, PNG, or WebP image");
    const updatedAt = Date.now();
    await store.setAvatar(account.uid, { contentType: match[1], data: match[2], updatedAt });
    profile.photoUrl = avatarUrl(account.uid, updatedAt);
  }
  // Firestore rejects undefined inside a map that replaces a field.
  const clean = Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined)) as Profile;

  const user = applyProfile(account, clean);
  await store.setProfile(account.uid, clean, { name: user.name, title: user.title, photoUrl: user.photoUrl });
  forgetProfile(account.uid);
  return json({ user });
});
