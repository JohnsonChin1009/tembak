const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function randomId(len = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function kebab(input: string, max = 40): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max)
      .replace(/-+$/g, "") || "app"
  );
}

/**
 * Formats a channel name as it's typed, like Discord: lowercase, spaces become dashes,
 * and other symbols drop out. Keeps a trailing dash so the next word can follow it;
 * the server's `kebab` trims it on save.
 */
export function channelNameDraft(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-/, "");
}

export function appSlug(title: string): string {
  return `${kebab(title)}-${randomId(4)}`;
}
