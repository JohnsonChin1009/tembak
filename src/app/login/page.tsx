import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
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
      <section className="relative hidden overflow-hidden border-r border-line bg-panel p-12 lg:flex lg:flex-col">
        <Logo className="text-lg" />
        <div className="mt-auto max-w-lg">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Disposable software</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.05] tracking-tight">
            Talk it through.
            <br />
            <span className="text-muted">Then ship the app.</span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-muted">
            Tembak is a team chat that builds software. When the conversation has enough context, tag{" "}
            <span className="rounded bg-accent-dim px-1.5 py-0.5 font-medium text-accent">@tembak</span> and get a
            working dashboard, tracker, or tool, live on a link, in about a minute.
          </p>
        </div>
        <ChatSketch />
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo className="mb-10 text-lg lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-tight">Sign in to your workspace</h2>
          <p className="mt-2 text-sm text-muted">
            {cfg.authMode === "firebase"
              ? "Use your Google account."
              : "Local dev mode: pick any name. Open a second window with another name to chat with yourself."}
          </p>
          <div className="mt-8">
            <LoginForm mode={cfg.authMode} firebase={cfg.firebaseWeb} next={nextPath} />
          </div>
        </div>
      </section>
    </main>
  );
}

function ChatSketch() {
  return (
    <div aria-hidden className="mt-12 max-w-lg space-y-3 text-sm">
      <div className="flex gap-3">
        <div className="size-7 shrink-0 rounded-md bg-info/20" />
        <p className="rounded-lg border border-line bg-raised px-3 py-2 text-muted">
          Need cost per sign-up by channel. I&apos;m tired of pivot tables.
        </p>
      </div>
      <div className="flex gap-3">
        <div className="size-7 shrink-0 rounded-md bg-warn/20" />
        <p className="rounded-lg border border-line bg-raised px-3 py-2 text-muted">
          <span className="text-accent">@tembak</span> make us a dashboard for this
        </p>
      </div>
      <div className="flex gap-3">
        <div className="size-7 shrink-0 rounded-md bg-accent" />
        <div className="flex-1 rounded-lg border border-accent/30 bg-accent-dim px-3 py-2">
          <p className="font-medium text-fg">Q4 Campaign Dashboard · v1</p>
          <p className="mt-0.5 text-xs text-muted">Live at apps.tembak.dev/q4-campaign-x7k2</p>
        </div>
      </div>
    </div>
  );
}
