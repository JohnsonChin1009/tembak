export const AGENT_HANDLE = "tembak";
export const MENTION_RE = /(^|\s)@tembak\b/i;

export function mentionsAgent(text: string): boolean {
  return MENTION_RE.test(text);
}

/** Removes the @tembak handle so the agent sees the request itself. */
export function stripMention(text: string): string {
  return text.replace(/(^|\s)@tembak\b[,:]?/gi, "$1").trim();
}

// Code spans and blocks stay literal, so tags inside them don't count (as in rich-text).
const CODE_RE = /```[\s\S]*?```|`[^`
]*`/g;

/** Uids tagged as "<@uid>" in a message, once each. */
export function taggedUids(text: string): string[] {
  const uids = [...text.replace(CODE_RE, "").matchAll(/<@([A-Za-z0-9_-]+)>/g)].map((m) => m[1]);
  return [...new Set(uids)];
}
