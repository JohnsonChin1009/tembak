"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, type LucideIcon } from "lucide-react";

export type MenuItem = { label: string; icon: LucideIcon; run: () => void | Promise<void> };

const MARGIN = 8;

/**
 * Slack's right-click menu for a message, at the cursor and kept on screen.
 * Closes on a pick, a click elsewhere, Escape, scroll, or resize.
 */
export function MessageMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [done, setDone] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: Math.max(MARGIN, Math.min(x, window.innerWidth - width - MARGIN)),
      top: Math.max(MARGIN, Math.min(y, window.innerHeight - height - MARGIN)),
    });
    el.querySelector<HTMLButtonElement>("button")?.focus();
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Handled here, so an open thread or profile panel stays open.
      e.preventDefault();
      onClose();
    };
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        const buttons = [...(ref.current?.querySelectorAll("button") ?? [])];
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }}
      className="fixed z-50 min-w-48 rounded-lg border border-line-strong bg-raised py-1 text-sm shadow-2xl shadow-black/50"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={async () => {
            await item.run();
            if (item.label.startsWith("Copy")) {
              // A beat of confirmation before closing, since copying has no other feedback.
              setDone(item.label);
              setTimeout(onClose, 600);
            } else onClose();
          }}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-fg outline-none hover:bg-accent hover:text-accent-ink focus-visible:bg-accent focus-visible:text-accent-ink"
        >
          {done === item.label ? <Check className="size-4" /> : <item.icon className="size-4" />}
          {done === item.label ? "Copied" : item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
