import { redirect } from "next/navigation";
import { Logo, LogoMark } from "@/components/logo";
import { getSessionUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") ? next : "/";
  if (await getSessionUser()) redirect(nextPath);

  const cfg = config();
  return (
    <main className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col overflow-hidden px-6 pt-6 pb-2 lg:border-r lg:border-line lg:bg-panel lg:p-12">
        <Reticle className="pointer-events-none absolute -top-40 -right-40 hidden w-[34rem] lg:block" />
        <Logo className="relative text-lg" />

        <div className="relative mt-8 max-w-lg lg:my-auto lg:pt-12">
          <h1 className="text-[2rem] font-semibold leading-[1.05] tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Talk it through.
            <br />
            <span className="text-muted">Then ship the app.</span>
          </h1>
          <p className="mt-6 hidden text-base leading-relaxed text-muted lg:block">
            Tembak is a team chat that builds software. When the conversation has enough context, tag{" "}
            <span className="rounded bg-accent-dim px-1.5 py-0.5 font-medium text-accent">@tembak</span> and get a
            working dashboard, tracker, or tool, live on a link, in about a minute.
          </p>
          <ChatDemo />
        </div>

        <p className="relative mt-10 hidden text-sm text-muted lg:block">Disposable software, built from conversation.</p>
      </section>

      <section className="flex justify-center px-6 pt-6 pb-12 lg:items-center lg:p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold lg:text-2xl tracking-tight">Sign in to your workspace</h2>
          <p className="mt-2 text-sm text-muted">
            {cfg.authMode === "firebase"
              ? "Use your Google account."
              : "Local dev mode: pick any name. Open a second window with another name to chat with yourself."}
          </p>
          <div className="mt-6 lg:mt-8">
            <LoginForm mode={cfg.authMode} firebase={cfg.firebaseWeb} next={nextPath} />
          </div>
        </div>
      </section>
    </main>
  );
}

const CHANNELS = [
  { name: "Referral", cost: 4.1 },
  { name: "Search", cost: 7.8 },
  { name: "Email", cost: 9.6 },
  { name: "Social", cost: 13.2 },
];

/** Plays the product loop once on load: a need, a mention, a build, a live app. */
function ChatDemo() {
  const max = Math.max(...CHANNELS.map((c) => c.cost));
  return (
    <div aria-hidden className="mt-6 space-y-3 text-sm lg:mt-12 lg:space-y-4">
      <Message delay={0.3} who="Aisha" initial="A" tint="bg-info/20 text-info">
        Need cost per sign-up by channel. I&apos;m tired of pivot tables.
      </Message>
      <Message delay={1.1} who="Wei Ling" initial="W" tint="bg-warn/20 text-warn">
        <span className="rounded bg-accent-dim px-0.5 font-medium text-accent">@tembak</span> make us a dashboard for
        this
      </Message>

      <div className="chat-in flex gap-3" style={{ "--d": "2s" } as React.CSSProperties}>
        <LogoMark className="size-7 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="text-xs">
            <span className="font-semibold text-fg">Tembak</span>
            <span className="ml-2 rounded bg-raised px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-faint">
              agent
            </span>
          </p>
          <div className="mt-1.5 grid">
            <p className="chat-building col-start-1 row-start-1 flex items-center gap-2 self-start py-1">
              <span className="dot-pulse flex gap-0.5">
                <span className="size-1 rounded-full bg-accent" />
                <span className="size-1 rounded-full bg-accent" />
                <span className="size-1 rounded-full bg-accent" />
              </span>
              <span className="sheen">Building Q4 Campaign Dashboard</span>
            </p>

            <div
              className="chat-in col-start-1 row-start-1 rounded-lg border border-accent/30 bg-raised p-3 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.6)]"
              style={{ "--d": "3.7s" } as React.CSSProperties}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium text-fg">Q4 Campaign Dashboard</p>
                <p className="shrink-0 font-mono text-[11px] text-faint">v1</p>
              </div>
              <p className="mt-0.5 hidden text-xs text-muted sm:block">Cost per sign-up, last 30 days</p>
              <ul className="mt-3 space-y-1.5">
                {CHANNELS.map((c, i) => (
                  <li key={c.name} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2 text-xs">
                    <span className="text-muted">{c.name}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-line">
                      <span
                        className="bar-grow block h-full rounded-full bg-accent"
                        style={
                          {
                            width: `${(c.cost / max) * 100}%`,
                            "--d": `${3.95 + i * 0.08}s`,
                          } as React.CSSProperties
                        }
                      />
                    </span>
                    <span className="text-right font-mono tabular-nums text-fg">${c.cost.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p
                className="chat-in mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-xs text-muted"
                style={{ "--d": "4.5s" } as React.CSSProperties}
              >
                <span className="size-1.5 rounded-full bg-accent" />
                <span className="shrink-0">Live at</span>
                <span className="truncate font-mono text-fg">apps.tembak.dev/q4-campaign-x7k2</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Message({
  delay,
  who,
  initial,
  tint,
  children,
}: {
  delay: number;
  who: string;
  initial: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="chat-in flex gap-3" style={{ "--d": `${delay}s` } as React.CSSProperties}>
      <span className={`grid size-7 shrink-0 place-items-center rounded-md text-xs font-semibold ${tint}`}>
        {initial}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-fg">{who}</p>
        <p className="mt-0.5 leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

/** The 404 page's target, as quiet texture behind the story. */
function Reticle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" aria-hidden className={className}>
      <g fill="none" stroke="var(--line)" strokeWidth="1">
        <circle cx="120" cy="120" r="112" />
        <circle cx="120" cy="120" r="80" />
        <circle cx="120" cy="120" r="48" />
        <circle cx="120" cy="120" r="16" stroke="var(--line-strong)" />
        <path d="M120 0 V36 M120 204 V240 M0 120 H36 M204 120 H240" stroke="var(--line-strong)" />
      </g>
    </svg>
  );
}
