import Link from "next/link";
import { redirect } from "next/navigation";
import { CenteredShell } from "@/components/centered-shell";
import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { JoinButton } from "./join-button";

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);

  const store = await getStore();
  const ws = await store.getWorkspaceByInvite(token);
  if (!ws || ws.open) {
    return (
      <CenteredShell>
        <h1 className="text-2xl font-semibold tracking-tight">This invite link is no longer valid</h1>
        <p className="mt-2 text-sm text-muted">Ask whoever sent it for a fresh link.</p>
        <Link href="/" className="mt-8 inline-block text-sm font-medium text-accent hover:underline">
          Go to my workspaces
        </Link>
      </CenteredShell>
    );
  }
  if (await store.getMember(ws.id, user.uid)) redirect(`/w/${ws.slug}`);

  const members = await store.listMembers(ws.id);
  return (
    <CenteredShell>
      <p className="text-sm text-muted">You&apos;ve been invited to</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{ws.name}</h1>
      <p className="mt-2 text-sm text-muted">
        {members.length} {members.length === 1 ? "member" : "members"}. You&apos;ll join as {user.name}.
      </p>
      <div className="mt-8">
        <JoinButton token={token} />
      </div>
    </CenteredShell>
  );
}
