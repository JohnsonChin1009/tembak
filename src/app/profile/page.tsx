import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CenteredShell } from "@/components/centered-shell";
import { getSessionAccount, getSessionUser } from "@/lib/auth/session";
import { homeWorkspace } from "@/lib/workspaces";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const [session, user, query] = await Promise.all([getSessionAccount(), getSessionUser(), searchParams]);
  if (!session || !user) redirect("/login?next=/profile");

  // Only same-site workspace paths, so ?back= can't send people elsewhere.
  const asked = typeof query.back === "string" && /^\/w\/[^/]/.test(query.back) ? query.back : null;
  const home = asked ? null : await homeWorkspace(user);
  const back = asked ?? (home ? `/w/${home.slug}` : "/new");

  return (
    <CenteredShell>
      <Link href={back} className="mb-6 flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> Back to workspace
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
      <p className="mt-2 text-sm text-muted">This is how teammates see you in every workspace.</p>
      <div className="mt-8">
        <ProfileForm user={user} accountPhotoUrl={session.account.photoUrl} usingAccountPhoto={session.profile.photoUrl === undefined} />
      </div>
    </CenteredShell>
  );
}
