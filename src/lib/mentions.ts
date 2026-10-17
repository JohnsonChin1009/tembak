export const AGENT_HANDLE = "tembak";
export const MENTION_RE = /(^|\s)@tembak\b/i;

export function mentionsAgent(text: string): boolean {
  return MENTION_RE.test(text);
}

/** Removes the @tembak handle so the agent sees the request itself. */
export function stripMention(text: string): string {
  return text.replace(/(^|\s)@tembak\b[,:]?/gi, "$1").trim();
}
