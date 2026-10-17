"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CodeView({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative h-full overflow-auto bg-bg">
      <button
        onClick={copy}
        className="sticky top-3 z-10 float-right mr-3 flex items-center gap-1.5 rounded-md border border-line-strong bg-raised px-2 py-1 text-xs text-muted hover:text-fg"
      >
        {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="py-3 font-mono text-[12.5px] leading-[1.6]">
        {lines.map((l, i) => (
          <div key={i} className="flex hover:bg-white/[0.02]">
            <span className="w-12 shrink-0 select-none pr-4 text-right text-faint">{i + 1}</span>
            <code className="whitespace-pre pr-6 text-fg/85">{l || " "}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}
