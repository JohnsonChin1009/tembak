"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { EditorContent, Extension, Node, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowUp,
  AtSign,
  Bold,
  Code,
  Italic,
  Link2,
  List,
  ListOrdered,
  SendHorizontal,
  Smile,
  SquareCode,
  Strikethrough,
  TextQuote,
  Type,
} from "lucide-react";
import { Avatar } from "@/components/avatar";
import { LogoMark } from "@/components/logo";
import { usePeople } from "@/components/people/people-context";
import { toMarkdown } from "./to-markdown";

export type ComposerHandle = { insert: (text: string) => void; focus: () => void };

type Props = {
  placeholder: string;
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  /** Single plain-text row with an inline send button, for tight spaces like the builder panel. */
  compact?: boolean;
  autoFocus?: boolean;
};

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(props, ref) {
  return props.compact ? <PlainComposer ref={ref} {...props} /> : <RichComposer ref={ref} {...props} />;
});

/** Returns the partial handle typed right before the caret, e.g. "tem" for "hey @tem|". */
function mentionQuery(before: string): string | null {
  const m = /(^|\s)@([\p{L}\p{N}._-]*)$/u.exec(before);
  return m ? m[2].toLowerCase() : null;
}

/** Someone to @-mention; uid "agent" is Tembak. */
type Mentionable = { uid: string; name: string; photoUrl?: string; detail?: string };

const TEMBAK: Mentionable = { uid: "agent", name: "tembak", detail: "Builds apps from this conversation" };
const MAX_SUGGESTIONS = 6;

/**
 * A tagged person (or Tembak), shown as a chip while composing. Saved as "<@uid>",
 * so it survives renames; Tembak stays "@tembak", which is what triggers the agent.
 */
const MentionNode = Node.create({
  name: "mention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,
  addAttributes() {
    return { uid: { default: null }, label: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "span[data-mention]" }];
  },
  renderHTML({ node }) {
    return ["span", { "data-mention": node.attrs.uid, class: "mention" }, `@${node.attrs.label}`];
  },
  renderText({ node }) {
    return `@${node.attrs.label}`;
  },
});

const EMOJI = ["👍", "🙏", "🎉", "✅", "👀", "🔥", "🚀", "💯", "😂", "😅", "🙌", "❤️", "🤔", "👏", "😍", "😮", "😢", "⚡", "📈", "📌", "💡", "⏳", "❌", "⚠️"];

type Format = {
  label: string;
  keys: string;
  icon: typeof Bold;
  /** Name for editor.isActive. */
  active: string;
  run: (editor: Editor) => void;
};

const chain = (editor: Editor) => editor.chain().focus();

// Slack's toolbar, as toggles: active while the caret is inside the format, and
// turning one on applies it to the selection or to whatever is typed next.
const FORMATS: (Format | "|")[] = [
  { label: "Bold", keys: "⌘B", icon: Bold, active: "bold", run: (e) => chain(e).toggleBold().run() },
  { label: "Italic", keys: "⌘I", icon: Italic, active: "italic", run: (e) => chain(e).toggleItalic().run() },
  { label: "Strikethrough", keys: "⌘⇧X", icon: Strikethrough, active: "strike", run: (e) => chain(e).toggleStrike().run() },
  "|",
  { label: "Link", keys: "⌘⇧U", icon: Link2, active: "link", run: () => {} },
  "|",
  { label: "Numbered list", keys: "⌘⇧7", icon: ListOrdered, active: "orderedList", run: (e) => chain(e).toggleOrderedList().run() },
  { label: "Bulleted list", keys: "⌘⇧8", icon: List, active: "bulletList", run: (e) => chain(e).toggleBulletList().run() },
  "|",
  { label: "Quote", keys: "⌘⇧9", icon: TextQuote, active: "blockquote", run: (e) => chain(e).toggleBlockquote().run() },
  { label: "Code", keys: "⌘⇧C", icon: Code, active: "code", run: (e) => chain(e).toggleCode().run() },
  { label: "Code block", keys: "⌘⌥⇧C", icon: SquareCode, active: "codeBlock", run: (e) => chain(e).toggleCodeBlock().run() },
];

const ACTIVE_KEYS = FORMATS.flatMap((f) => (f === "|" ? [] : [f.active]));

const RichComposer = forwardRef<ComposerHandle, Props>(function RichComposer(
  { placeholder, onSend, disabled, autoFocus },
  ref,
) {
  const [showFormatting, setShowFormatting] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  // Keyboard handlers live in the editor, created once; refs give them current values.
  const people = usePeople();
  const [highlighted, setHighlighted] = useState(0);
  const actions = useRef<{
    submit: () => boolean;
    completeMention: () => boolean;
    moveMention: (by: number) => boolean;
    mentionOpen: boolean;
    openLink: () => void;
  }>({
    submit: () => false,
    completeMention: () => false,
    moveMention: () => false,
    mentionOpen: false,
    openLink: () => {},
  });

  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
      MentionNode,
      Extension.create({
        name: "slackKeys",
        // Higher than StarterKit, so Enter sends instead of starting a new paragraph.
        priority: 1000,
        addKeyboardShortcuts() {
          return {
            Enter: () => (actions.current.mentionOpen ? actions.current.completeMention() : actions.current.submit()),
            Tab: () => actions.current.mentionOpen && actions.current.completeMention(),
            ArrowDown: () => actions.current.mentionOpen && actions.current.moveMention(1),
            ArrowUp: () => actions.current.mentionOpen && actions.current.moveMention(-1),
            // A new line: next list item or code line where that applies, else a new paragraph,
            // so typing "- " or "> " at its start still turns into a list or quote.
            "Shift-Enter": ({ editor }) =>
              editor.commands.first(({ commands }) => [
                () => commands.newlineInCode(),
                () => commands.splitListItem("listItem"),
                () => commands.splitBlock(),
              ]),
            "Mod-Shift-x": ({ editor }) => editor.commands.toggleStrike(),
            "Mod-Shift-c": ({ editor }) => editor.commands.toggleCode(),
            "Mod-Alt-Shift-c": ({ editor }) => editor.commands.toggleCodeBlock(),
            "Mod-Shift-9": ({ editor }) => editor.commands.toggleBlockquote(),
            "Mod-Shift-u": () => {
              actions.current.openLink();
              return true;
            },
          };
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: "md max-h-[300px] overflow-y-auto px-3 py-2 text-[15px] leading-[22px] outline-none",
        "aria-label": placeholder,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { active: new Set<string>(), empty: true, mention: null as string | null };
      const { $from, empty } = e.state.selection;
      const before = empty ? $from.parent.textBetween(0, $from.parentOffset, undefined, "￼") : "";
      return {
        active: new Set(ACTIVE_KEYS.filter((k) => e.isActive(k))),
        empty: e.isEmpty,
        mention: mentionQuery(before),
      };
    },
  });
  const query = state?.mention ?? null;
  const suggestions = query === null ? [] : suggest(query, people);
  const showMention = suggestions.length > 0;
  const selected = Math.min(highlighted, suggestions.length - 1);
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) {
    // A new query starts from the top of the list.
    setLastQuery(query);
    setHighlighted(0);
  }

  function completeMention(pick = suggestions[selected]) {
    if (!editor || query === null || !pick) return false;
    const to = editor.state.selection.from;
    const from = to - query.length - 1;
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, [
        { type: "mention", attrs: { uid: pick.uid, label: pick.name } },
        { type: "text", text: " " },
      ])
      .run();
    return true;
  }

  async function submit() {
    if (!editor || disabled) return true;
    const text = toMarkdown(editor.getJSON());
    if (!text) return true;
    editor.commands.clearContent(true);
    await onSend(text);
    return true;
  }

  function startMention() {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
    editor.chain().focus().insertContent(before && !/\s$/.test(before) ? " @" : "@").run();
  }

  useLayoutEffect(() => {
    actions.current = {
      submit: () => {
        void submit();
        return true;
      },
      completeMention: () => completeMention(),
      moveMention: (by) => {
        setHighlighted((i) => (i + by + suggestions.length) % suggestions.length);
        return true;
      },
      mentionOpen: showMention,
      openLink: () => setLinkOpen(true),
    };
  });

  useImperativeHandle(ref, () => ({
    insert(text) {
      editor?.chain().setContent({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] }).focus("end").run();
    },
    focus() {
      editor?.commands.focus();
    },
  }));

  const canSend = !!state && !state.empty && !disabled;

  return (
    <div className="relative">
      {showMention ? (
        <div
          role="listbox"
          aria-label="Mention someone"
          className="absolute bottom-full left-0 z-20 mb-2 w-80 overflow-hidden rounded-xl border border-line-strong bg-raised py-1 shadow-2xl shadow-black/50"
        >
          {suggestions.map((p, i) => (
            <button
              key={p.uid}
              type="button"
              role="option"
              aria-selected={i === selected}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                completeMention(p);
              }}
              className={clsx("flex w-full items-center gap-3 px-3 py-1.5 text-left", i === selected && "bg-hover")}
            >
              {p.uid === "agent" ? (
                <LogoMark className="size-7 rounded-md" />
              ) : (
                <Avatar name={p.name} seed={p.uid} photoUrl={p.photoUrl} className="size-7 rounded-md" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.uid === "agent" ? "@tembak" : p.name}</span>
                {p.detail ? <span className="block truncate text-xs text-muted">{p.detail}</span> : null}
              </span>
              {i === selected ? (
                <kbd className="ml-auto rounded border border-line-strong px-1.5 font-mono text-[10px] text-faint">tab</kbd>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {linkOpen && editor ? <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} /> : null}

      <div className="rounded-lg border border-line-strong bg-raised transition focus-within:border-faint">
        {showFormatting ? (
          <div className="flex items-center gap-0.5 px-1.5 pt-1.5" role="toolbar" aria-label="Formatting">
            {FORMATS.map((f, i) =>
              f === "|" ? (
                <span key={i} className="mx-1 h-4 w-px bg-line-strong" aria-hidden />
              ) : (
                <ToolButton
                  key={f.label}
                  label={`${f.label} (${f.keys})`}
                  active={state?.active.has(f.active)}
                  onClick={() => (f.active === "link" ? setLinkOpen(true) : editor && f.run(editor))}
                  disabled={disabled || !editor}
                >
                  <f.icon className="size-4" />
                </ToolButton>
              ),
            )}
          </div>
        ) : null}

        <EditorContent editor={editor} />

        <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
          <ToolButton
            label={showFormatting ? "Hide formatting" : "Show formatting"}
            onClick={() => setShowFormatting((v) => !v)}
            active={showFormatting}
          >
            <Type className="size-4" />
          </ToolButton>
          <div className="relative">
            <ToolButton label="Emoji" onClick={() => setEmojiOpen((v) => !v)} active={emojiOpen} disabled={disabled}>
              <Smile className="size-4" />
            </ToolButton>
            {emojiOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close emoji picker"
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setEmojiOpen(false)}
                />
                <div className="absolute bottom-full left-0 z-30 mb-2 grid w-64 grid-cols-8 gap-0.5 rounded-xl border border-line-strong bg-raised p-2 shadow-2xl shadow-black/50">
                  {EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setEmojiOpen(false);
                        editor?.chain().focus().insertContent(emoji).run();
                      }}
                      className="grid size-7 place-items-center rounded-md text-lg hover:bg-hover"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <ToolButton label="Mention @tembak" onClick={startMention} disabled={disabled}>
            <AtSign className="size-4" />
          </ToolButton>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSend}
            aria-label="Send"
            title="Send (Enter)"
            className={clsx(
              "ml-auto grid h-7 w-9 place-items-center rounded-md transition",
              canSend ? "bg-accent text-accent-ink hover:brightness-110" : "text-faint",
            )}
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

/** Tembak and members whose name (or any word of it) starts with the query. */
function suggest(query: string, people: ReturnType<typeof usePeople>): Mentionable[] {
  const matches = (name: string) => name.toLowerCase().split(/\s+/).some((w) => w.startsWith(query)) || name.toLowerCase().startsWith(query);
  const members: Mentionable[] = (people?.members ?? [])
    .filter((m) => matches(m.name))
    .map((m) => ({ uid: m.uid, name: m.name, photoUrl: m.photoUrl, detail: m.uid === people?.me.uid ? "you" : m.title }));
  return [...(matches(TEMBAK.name) ? [TEMBAK] : []), ...members].slice(0, MAX_SUGGESTIONS);
}

/** Slack's link prompt: a URL for the selected text, or text plus URL when nothing is selected. */
function LinkPopover({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const hasSelection = !editor.state.selection.empty;
  const [text, setText] = useState("");
  const [href, setHref] = useState((editor.getAttributes("link").href as string | undefined) ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const url = href.trim();
    const c = editor.chain().focus();
    if (!url) c.extendMarkRange("link").unsetLink().run();
    else if (hasSelection || editor.isActive("link")) c.extendMarkRange("link").setLink({ href: url }).run();
    else c.insertContent({ type: "text", text: text.trim() || url, marks: [{ type: "link", attrs: { href: url } }] }).unsetMark("link").insertContent(" ").run();
    onClose();
  }

  const field =
    "h-8 w-full rounded-md border border-line-strong bg-panel px-2 text-sm outline-none placeholder:text-faint focus:border-accent";
  return (
    <>
      <button type="button" aria-label="Cancel link" className="fixed inset-0 z-20 cursor-default" onClick={onClose} />
      <form
        onSubmit={apply}
        onKeyDown={(e) => e.key === "Escape" && (e.preventDefault(), onClose(), editor.commands.focus())}
        className="absolute bottom-full left-0 z-30 mb-2 w-80 space-y-2 rounded-xl border border-line-strong bg-raised p-3 shadow-2xl shadow-black/50"
      >
        {!hasSelection && !editor.isActive("link") ? (
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Text" className={field} />
        ) : null}
        <input
          autoFocus={hasSelection || editor.isActive("link")}
          value={href}
          onChange={(e) => setHref(e.target.value)}
          placeholder="https://"
          className={field}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-2.5 py-1 text-sm text-muted hover:bg-hover hover:text-fg">
            Cancel
          </button>
          <button type="submit" className="rounded-md bg-accent px-2.5 py-1 text-sm font-medium text-accent-ink hover:brightness-110">
            Save
          </button>
        </div>
      </form>
    </>
  );
}

const PlainComposer = forwardRef<ComposerHandle, Props>(function PlainComposer(
  { placeholder, onSend, disabled, autoFocus },
  ref,
) {
  const [value, setValue] = useState("");
  const el = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    insert(text) {
      setValue(text);
      requestAnimationFrame(() => {
        el.current?.focus();
        el.current?.setSelectionRange(text.length, text.length);
      });
    },
    focus() {
      el.current?.focus();
    },
  }));

  useLayoutEffect(() => {
    const ta = el.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`;
  }, [value]);

  async function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    await onSend(text);
  }

  return (
    <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-raised p-1.5 pl-3 transition focus-within:border-faint">
      <textarea
        ref={el}
        rows={1}
        autoFocus={autoFocus}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        className="max-h-[220px] flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed outline-none placeholder:text-faint"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!value.trim() || disabled}
        aria-label="Send"
        className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink transition hover:brightness-110 disabled:bg-hover disabled:text-faint"
      >
        <ArrowUp className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
});

function ToolButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // Keep focus (and the selection) in the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        "grid size-7 place-items-center rounded-md transition hover:bg-hover hover:text-fg disabled:opacity-40",
        active ? "bg-hover text-fg" : "text-muted",
      )}
    >
      {children}
    </button>
  );
}
