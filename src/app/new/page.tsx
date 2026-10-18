import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, AtSign, MessagesSquare, Rocket } from "lucide-react";
import { CenteredShell } from "@/components/centered-shell";
import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { DEMO_WORKSPACE_ID, homeWorkspace } from "@/lib/workspaces";
import { NewWorkspaceForm } from "./new-workspace-form";

const HOW = [
  { icon: MessagesSquare, text: "Chat with your team in channels" },
  { icon: AtSign, text: "Tag @tembak to build an app from the conversation" },
  { icon: Rocket, text: "Publish it to a live link" },
];

export default async function NewWorkspacePage({ searchParams }: PageProps<"/new">) {
  const [user, query] = await Promise.all([getSessionUser(), searchParams]);
  if (!user) redirect("/login?next=/new");
  const demo = await (await getStore()).getWorkspace(DEMO_WORKSPACE_ID);

  // Only same-site workspace paths, so ?back= can't send people elsewhere.
  // No workspace yet means "/" lands right back here, so there's nothing to cancel to.
  const asked = typeof query.back === "string" && /^\/w\/[^/]/.test(query.back) ? query.back : null;
  const home = asked ? null : await homeWorkspace(user);
  const back = asked ?? (home ? `/w/${home.slug}` : null);

  return (
    <CenteredShell>
      {back ? (
        <Link href={back} className="mb-6 flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-3.5" /> Back to workspace
        </Link>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-tight">Name your workspace</h1>
      <p className="mt-2 text-sm text-muted">
        A private space for your team&apos;s channels, data, and the apps Tembak builds. You can invite people next.
      </p>
      <ul className="mt-6 space-y-2.5 text-sm">
        {HOW.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-3 text-muted">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-dim text-accent">
              <Icon className="size-3.5" />
            </span>
            {text}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <NewWorkspaceForm />
      </div>
      {demo ? (
        <div className="mt-10 border-t border-line pt-6">
          <Link
            href={`/w/${demo.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent"
          >
            Or explore the demo workspace <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </CenteredShell>
  );
}
