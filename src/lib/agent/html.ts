const MAX_HTML_BYTES = 500_000;

export class InvalidHtmlError extends Error {}

/** Pulls a full HTML document out of a model response and checks the output contract. */
export function extractHtml(raw: string): { html: string; summary?: string } {
  let text = raw.trim();
  const fenced = /```(?:html)?\s*\n([\s\S]*?)```/i.exec(text);
  if (fenced) text = fenced[1].trim();

  const start = text.search(/<!doctype html|<html[\s>]/i);
  if (start < 0) throw new InvalidHtmlError("Response did not contain an HTML document.");
  text = text.slice(start);
  const end = text.toLowerCase().lastIndexOf("</html>");
  if (end < 0) throw new InvalidHtmlError("HTML document was cut off (no closing </html>).");
  text = text.slice(0, end + "</html>".length);
  if (!/^<!doctype html/i.test(text)) text = `<!doctype html>\n${text}`;

  if (new TextEncoder().encode(text).length > MAX_HTML_BYTES) {
    throw new InvalidHtmlError("HTML is larger than 500KB. Keep embedded data small.");
  }

  const summary = /<!--\s*tembak:summary:?\s*([\s\S]*?)-->/i.exec(text)?.[1]?.trim();
  return { html: text, summary };
}
