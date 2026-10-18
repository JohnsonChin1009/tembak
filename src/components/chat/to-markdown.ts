import type { JSONContent } from "@tiptap/react";

/**
 * The composer's document as the markdown messages are stored in. Covers what the
 * toolbar can make: bold, italic, strike, inline code, links, lists, quotes, code blocks,
 * and @-mentions.
 */
export function toMarkdown(doc: JSONContent): string {
  return blocks(doc.content).trim();
}

/**
 * Lines typed one after another stay one newline apart, which messages render as line
 * breaks. After a list or quote it takes a blank line, or the next line would join it.
 */
function blocks(nodes: JSONContent[] = []): string {
  return nodes
    .map((node, i) => {
      const prev = nodes[i - 1];
      if (!prev) return block(node);
      const sep = prev.type === "paragraph" ? "\n" : "\n\n";
      return sep + block(node);
    })
    .join("");
}

function block(node: JSONContent): string {
  switch (node.type) {
    case "paragraph":
      return inline(node.content);
    case "codeBlock":
      return "```\n" + (node.content ?? []).map((n) => n.text ?? "").join("") + "\n```";
    case "blockquote":
      return prefix(blocks(node.content), () => "> ", () => "> ");
    case "bulletList":
      return items(node, () => "- ");
    case "orderedList": {
      const start = (node.attrs?.start as number | undefined) ?? 1;
      return items(node, (i) => `${start + i}. `);
    }
    default:
      return node.content ? blocks(node.content) : (node.text ?? "");
  }
}

function items(list: JSONContent, marker: (i: number) => string): string {
  return (list.content ?? [])
    .map((item, i) => {
      const m = marker(i);
      // Nested blocks in an item sit tight under it, indented to the marker's width.
      const body = (item.content ?? []).map(block).join("\n");
      return prefix(body, () => m, () => " ".repeat(m.length));
    })
    .join("\n");
}

function prefix(text: string, first: () => string, rest: () => string): string {
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? first() : rest()) + line)
    .join("\n");
}

type Mark = { open: string; close: string; key: string };

function marksOf(node: JSONContent): Mark[] {
  const out: Mark[] = [];
  for (const m of node.marks ?? []) {
    if (m.type === "link") out.push({ key: `link:${m.attrs?.href}`, open: "[", close: `](${m.attrs?.href ?? ""})` });
    if (m.type === "bold") out.push({ key: "bold", open: "**", close: "**" });
    if (m.type === "italic") out.push({ key: "italic", open: "_", close: "_" });
    if (m.type === "strike") out.push({ key: "strike", open: "~~", close: "~~" });
    if (m.type === "code") out.push({ key: "code", open: "`", close: "`" });
  }
  // Code innermost, so other delimiters never end up inside backticks.
  return out.sort((a, b) => Number(a.key === "code") - Number(b.key === "code"));
}

/**
 * Text runs with marks, opening and closing delimiters only where a mark starts or
 * ends (so "**ab**", not "**a****b**"), with spaces kept outside delimiters, since
 * markdown ignores "** bold**".
 */
function inline(nodes: JSONContent[] = []): string {
  let out = "";
  let open: Mark[] = [];

  const closeTo = (keep: number) => {
    const trailing = /\s*$/.exec(out)![0];
    out = out.slice(0, out.length - trailing.length);
    while (open.length > keep) out += open.pop()!.close;
    out += trailing;
  };

  for (const raw of nodes) {
    // A mention is a token with the surrounding marks: "<@uid>", or "@tembak" for the agent.
    const node: JSONContent =
      raw.type === "mention"
        ? { ...raw, text: raw.attrs?.uid === "agent" ? "@tembak" : `<@${raw.attrs?.uid}>` }
        : raw;
    if (node.type === "hardBreak") {
      closeTo(0);
      out += "\n";
      continue;
    }
    const text = node.text ?? "";
    const marks = marksOf(node);
    let same = 0;
    while (same < open.length && same < marks.length && open[same].key === marks[same].key) same++;
    closeTo(same);
    const lead = /^\s*/.exec(text)![0];
    const toOpen = marks.slice(same);
    out += toOpen.length ? lead + toOpen.map((m) => m.open).join("") + text.slice(lead.length) : text;
    open = [...open, ...toOpen];
  }
  closeTo(0);
  return out;
}
