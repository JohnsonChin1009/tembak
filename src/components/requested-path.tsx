"use client";

import { usePathname } from "next/navigation";

export function RequestedPath() {
  const path = usePathname();
  return <code className="break-all text-fg">{path}</code>;
}
