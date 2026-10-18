import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Database,
  Globe,
  MessagesSquare,
  Rocket,
  Sparkles,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";

const STEPS = [
  {
    icon: MessagesSquare,
    title: "Talk it through",
    body: "Your team discusses the problem in a channel, the way you already do. Paste the sheet, argue about the metrics.",
  },
  {
    icon: Sparkles,
    title: "Tag @tembak",
    body: "When there's enough context, tag the agent. It asks what it's missing, then builds a working app from the conversation.",
  },
  {
    icon: Rocket,
    title: "Ship the link",
    body: "Preview it, ask for changes in plain words, and publish. Everyone gets a live URL in about a minute.",
  },
];

const USE_CASES = [
  { icon: BarChart3, title: "Campaign dashboards", body: "Cost per sign-up by channel, straight from the team's Google Sheet." },
  { icon: ClipboardList, title: "Ops trackers", body: "Shift handovers, incident logs, stock counts. Entries are saved." },
  { icon: Users, title: "Sign-up sheets", body: "Event RSVPs and volunteer rosters your whole team can fill in." },
  { icon: Database, title: "API views", body: "Point it at a JSON API. Keys stay on the server, never in the app." },
];

const STACK = ["Gemini", "Cloud Run", "Firestore", "Firebase Auth", "Secret Manager"];

export function Landing() {
  return (
    <div className="min-h-full overflow-x-hidden">
      <header className="sticky top-0 z-10 border-b border-line/60 bg-bg/80 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo className="text-base" />
          <div className="flex items-center gap-2 text-sm">
            <a href="#how" className="hidden rounded-md px-3 py-1.5 text-muted hover:text-fg sm:block">
              How it works
            </a>
            <a href="#use-cases" className="hidden rounded-md px-3 py-1.5 text-muted hover:text-fg sm:block">
              Use cases
            </a>
            <Link href="/login" className="rounded-md px-3 py-1.5 text-muted hover:text-fg">
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-ink hover:brightness-110"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Disposable software for teams</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Talk it through.
            <br />
            <span className="text-muted">Then ship the app.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Tembak is a team chat that builds software. Tag{" "}
            <span className="rounded bg-accent-dim px-1.5 py-0.5 font-medium text-accent">@tembak</span> and get a
            working dashboard, tracker, or tool from your conversation, live on Google Cloud in about a minute.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-ink hover:brightness-110"
            >
              Try it now <ArrowRight className="size-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center rounded-lg border border-line-strong px-5 py-2.5 font-medium hover:bg-hover"
            >
              See how it works
            </a>
          </div>

          <ProductShot />
        </section>

        <section id="how" className="border-t border-line bg-panel">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <SectionTitle eyebrow="How it works" title="From conversation to live app in three steps" />
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-xl border border-line bg-raised p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-accent-dim text-accent">
                      <step.icon className="size-4" />
                    </span>
                    <span className="font-mono text-xs text-faint">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="use-cases" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle eyebrow="Use cases" title="The tools nobody has time to build" />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u) => (
              <div key={u.title} className="rounded-xl border border-line p-5">
                <u.icon className="size-5 text-accent" />
                <h3 className="mt-4 font-semibold">{u.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{u.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line bg-panel">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-faint">Built on Google Cloud</p>
              <p className="mt-2 max-w-md text-sm text-muted">
                Every app is generated by Gemini, hosted on Cloud Run, and sandboxed on its own origin.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {STACK.map((s) => (
                <li key={s} className="rounded-full border border-line-strong px-3 py-1 text-sm">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
          <Globe className="mx-auto size-8 text-accent" />
          <h2 className="mx-auto mt-6 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Your next internal tool is one message away.
          </h2>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-medium text-accent-ink hover:brightness-110"
          >
            Open a workspace <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-faint sm:px-6">
          <Logo className="text-sm text-muted" />
          <span>Built for the Google AI Builder Cup</span>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

/** A static sketch of the workspace: chat on the left, the generated app on the right. */
function ProductShot() {
  const bars = [62, 88, 45, 74, 96, 58];
  return (
    <div aria-hidden className="mt-16 overflow-hidden rounded-xl border border-line-strong bg-panel shadow-2xl shadow-black/50">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="size-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 font-mono text-xs text-faint"># marketing</span>
      </div>
      <div className="grid md:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4 border-line p-5 text-sm md:border-r">
          <Bubble who="Aisha" tone="bg-info/20">
            Need cost per sign-up by channel. I&apos;m tired of pivot tables.
          </Bubble>
          <Bubble who="Ben" tone="bg-warn/20">
            Numbers are in the Q4 campaign sheet.
          </Bubble>
          <Bubble who="Aisha" tone="bg-info/20">
            <span className="text-accent">@tembak</span> make us a dashboard for this
          </Bubble>
          <div className="flex gap-3">
            <div className="size-7 shrink-0 rounded-md bg-accent" />
            <div className="flex-1 rounded-lg border border-accent/30 bg-accent-dim px-3 py-2">
              <p className="font-medium text-fg">Q4 Campaign Dashboard · v1</p>
              <p className="mt-0.5 text-xs text-muted">Built from the Q4 sheet · ready to publish</p>
            </div>
          </div>
        </div>
        <div className="hidden bg-bg p-5 md:block">
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Sign-ups", "4,812"],
              ["Spend", "$18.2k"],
              ["Cost / sign-up", "$3.78"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line bg-panel p-3">
                <p className="text-xs text-faint">{k}</p>
                <p className="mt-1 text-lg font-semibold">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-line bg-panel p-4">
            <p className="text-xs text-faint">Sign-ups by channel</p>
            <div className="mt-4 flex h-32 items-end gap-3">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 rounded-t bg-accent/80" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ who, tone, children }: { who: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className={`size-7 shrink-0 rounded-md ${tone}`} />
      <div>
        <p className="text-xs font-medium text-faint">{who}</p>
        <p className="mt-0.5 text-muted">{children}</p>
      </div>
    </div>
  );
}
