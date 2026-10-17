"use client";

import { useCallback, useRef, useState } from "react";

const KEY = "tembak:panel-width";
const MIN = 380;
const MIN_CHAT = 360;

function initial(): number {
  if (typeof window === "undefined") return 640;
  try {
    const saved = Number(window.localStorage.getItem(KEY));
    if (saved >= MIN) return saved;
  } catch {
    // storage unavailable
  }
  return Math.round(Math.max(MIN, (window.innerWidth - 256) * 0.55));
}

/** Drag-to-resize width for the builder panel, remembered per browser. */
export function usePanelWidth() {
  const [width, setWidth] = useState(initial);
  const containerRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    let last = 0;
    const move = (ev: PointerEvent) => {
      last = Math.min(Math.max(rect.right - ev.clientX, MIN), rect.width - MIN_CHAT);
      setWidth(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Iframes swallow pointer events during drag; restore them.
      document.querySelectorAll("iframe").forEach((f) => (f.style.pointerEvents = ""));
      try {
        if (last) window.localStorage.setItem(KEY, String(Math.round(last)));
      } catch {
        // storage unavailable
      }
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.querySelectorAll("iframe").forEach((f) => (f.style.pointerEvents = "none"));
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  return { width, containerRef, handleProps: { onPointerDown, role: "separator", "aria-orientation": "vertical" as const } };
}
