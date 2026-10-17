"use client";

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp } from "lucide-react";
import { LogoMark } from "@/components/logo";

export type ComposerHandle = { insert: (text: string) => void; focus: () => void };

/** Returns the partial handle being typed right before the caret, e.g. "tem" for "hey @tem|". */
function mentionQuery(value: string, caret: number): string | null {
  const m = /(^|\s)@([a-z]*)$/i.exec(value.slice(0, caret));
  return m ? m[2].toLowerCase() : null;
}

export const Composer = forwardRef<
  ComposerHandle,
  {
    placeholder: string;
    onSend: (text: string) => Promise<void> | void;
    disabled?: boolean;
    compact?: boolean;
    autoFocus?: boolean;
  }
>(function Composer({ placeholder, onSend, disabled, compact, autoFocus }, ref) {
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const el = useRef<HTMLTextAreaElement>(null);

  const query = mentionQuery(value, caret);
  const showMention = query !== null && "tembak".startsWith(query);

  useImperativeHandle(ref, () => ({
    insert(text) {
      setValue(text);
      requestAnimationFrame(() => {
        el.current?.focus();
        el.current?.setSelectionRange(text.length, text.length);
        setCaret(text.length);
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

  function completeMention() {
    const before = value.slice(0, caret).replace(/@([a-z]*)$/i, "@tembak ");
    const next = before + value.slice(caret);
    setValue(next);
    requestAnimationFrame(() => {
      el.current?.setSelectionRange(before.length, before.length);
      setCaret(before.length);
    });
  }

  async function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    setCaret(0);
    await onSend(text);
  }

  return (
    <div className="relative">
      {showMention ? (
        <div className="absolute bottom-full left-0 mb-2 w-80 overflow-hidden rounded-xl border border-line-strong bg-raised shadow-2xl shadow-black/50">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              completeMention();
            }}
            className="flex w-full items-center gap-3 bg-hover px-3 py-2.5 text-left"
          >
            <LogoMark className="size-7 rounded-md" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">@tembak</span>
              <span className="block truncate text-xs text-muted">Builds apps from this conversation</span>
            </span>
            <kbd className="ml-auto rounded border border-line-strong px-1.5 font-mono text-[10px] text-faint">tab</kbd>
          </button>
        </div>
      ) : null}
      <div
        className={clsx(
          "flex items-end gap-2 rounded-xl border border-line-strong bg-raised transition focus-within:border-faint",
          compact ? "p-1.5 pl-3" : "p-2 pl-4",
        )}
      >
        <textarea
          ref={el}
          rows={1}
          autoFocus={autoFocus}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setCaret(e.target.selectionStart);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={(e) => {
            if (showMention && (e.key === "Tab" || e.key === "Enter")) {
              e.preventDefault();
              completeMention();
              return;
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          className={clsx(
            "max-h-[220px] flex-1 resize-none bg-transparent leading-relaxed outline-none placeholder:text-faint",
            compact ? "py-1 text-sm" : "py-1.5 text-[15px]",
          )}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!value.trim() || disabled}
          aria-label="Send"
          className={clsx(
            "grid shrink-0 place-items-center rounded-lg bg-accent text-accent-ink transition hover:brightness-110 disabled:bg-hover disabled:text-faint",
            compact ? "size-7" : "size-8",
          )}
        >
          <ArrowUp className="size-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
});
