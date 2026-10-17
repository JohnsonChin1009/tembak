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

export function appSlug(title: string): string {
  return `${kebab(title)}-${randomId(4)}`;
}
