import Link from "next/link";
import clsx from "clsx";
import { Logo, LogoMark } from "@/components/logo";

type Variant = "miss" | "misfire";

/** Full-page layout for 404 and 500: reticle, headline, a note from the agent, actions. */
export function StatusPage({
  variant,
  code,
  title,
  body,
  note,
  actions,
  detail,
}: {
  variant: Variant;
  code: string;
  title: string;
  body: string;
  /** What @tembak would say about it, shown as a chat message. */
  note: React.ReactNode;
  actions: React.ReactNode;
  /** Small mono line at the bottom: the missed path, an error digest. */
  detail?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 sm:px-6">
        <Link href="/" className="rounded-md">
          <Logo className="text-base" />
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 pb-16 sm:px-6 md:grid-cols-[1fr_auto] md:gap-16">
        <div className="max-w-lg">
          <p
            className={clsx(
              "font-mono text-xs uppercase tracking-[0.2em]",
              variant === "miss" ? "text-accent" : "text-danger",
            )}
          >
            {code}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 text-base leading-relaxed text-muted">{body}</p>

          <div className="mt-8 flex gap-3">
            <LogoMark className="size-8 rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">Tembak</span>
                <span className="ml-2 rounded bg-raised px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
                  agent
                </span>
              </p>
              <div className="mt-1 text-sm leading-relaxed text-muted">{note}</div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-3">{actions}</div>

          {detail && <div className="mt-10 border-t border-line pt-4 font-mono text-xs text-faint">{detail}</div>}
        </div>

        <Reticle variant={variant} className="mx-auto w-56 sm:w-72 md:w-80" />
      </main>
    </div>
  );
}

export const primaryAction =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:brightness-110";
export const secondaryAction =
  "inline-flex items-center gap-2 rounded-lg border border-line-strong px-5 py-2.5 text-sm font-medium text-fg hover:bg-hover";

/** A target. "miss" lands the mark wide of it; "misfire" stalls halfway with a spark. */
function Reticle({ variant, className }: { variant: Variant; className?: string }) {
  const miss = variant === "miss";
  return (
    <svg viewBox="0 0 240 240" aria-hidden className={clsx("overflow-visible", className)}>
      <g fill="none" stroke="var(--line-strong)" strokeWidth="1.5">
        <circle cx="120" cy="120" r="96" />
        <circle cx="120" cy="120" r="64" />
        <circle cx="120" cy="120" r="32" stroke="var(--faint)" />
        <path d="M120 8 V40 M120 200 V232 M8 120 H40 M200 120 H232" stroke="var(--faint)" />
      </g>
      <circle cx="120" cy="120" r="4" fill={miss ? "var(--faint)" : "var(--danger)"} opacity={miss ? 1 : 0.5} />

      {miss ? (
        <>
          <Trajectory d="M-10 236 Q 90 150 206 30" color="var(--accent)" />
          <Mark x={196} y={6} fill="var(--accent)" ink="var(--accent-ink)" />
        </>
      ) : (
        <>
          <Trajectory d="M-10 236 Q 30 200 64 172" color="var(--danger)" />
          <Mark x={46} y={154} fill="var(--raised)" ink="var(--danger)" outline="var(--danger)" />
          <g stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" className="spark">
            <path d="M92 150 L102 142" />
            <path d="M94 164 L106 166" />
            <path d="M84 138 L88 126" />
          </g>
        </>
      )}
    </svg>
  );
}

function Trajectory({ d, color }: { d: string; color: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeDasharray="2 8"
      className="trajectory"
    />
  );
}

/** The logo mark, drawn in-SVG. The inner group animates so it doesn't clobber the position. */
function Mark({ x, y, fill, ink, outline }: { x: number; y: number; fill: string; ink: string; outline?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="mark-in">
        <rect width="36" height="36" rx="9" fill={fill} stroke={outline} strokeWidth="1.5" />
        <path
          d="M10 26 L24 12 M15 12 H24 V21"
          stroke={ink}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
    </g>
  );
}
