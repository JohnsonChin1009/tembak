import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { CenteredShell } from "@/components/centered-shell";
import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { DEMO_WORKSPACE_ID } from "@/lib/workspaces";
import { NewWorkspaceForm } from "./new-workspace-form";

export default async function NewWorkspacePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/new");
  const demo = await (await getStore()).getWorkspace(DEMO_WORKSPACE_ID);

  return (
    <CenteredShell>
      <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
      <p className="mt-2 text-sm text-muted">
        A private space for your team&apos;s channels, data, and the apps Tembak builds. You can invite people next.
      </p>
      <div className="mt-8">
        <NewWorkspaceForm />
      </div>
      {demo ? (
        <div className="mt-10 border-t border-line pt-6">
          <p className="text-sm text-muted">Just looking around?</p>
          <Link
            href={`/w/${demo.slug}`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Explore the demo workspace <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </CenteredShell>
  );
}
