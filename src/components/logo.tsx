import clsx from "clsx";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={clsx("shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M9 23 L21 11 M14 11 H21 V18"
        stroke="var(--accent-ink)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className="size-6" />
      tembak
    </span>
  );
}
