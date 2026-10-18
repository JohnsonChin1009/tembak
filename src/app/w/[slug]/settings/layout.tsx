import { notFound, redirect } from "next/navigation";
import { SettingsShell } from "@/components/settings/settings-shell";
import { getSessionUser } from "@/lib/auth/session";
import { getStore } from "@/lib/store";
import { membership, workspaceInfo } from "@/lib/workspaces";

export default async function SettingsLayout({ children, params }: LayoutProps<"/w/[slug]/settings">) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/w/${slug}/settings`)}`);
  const m = await membership(user, await (await getStore()).getWorkspaceBySlug(slug));
  if (!m) notFound();
  return <SettingsShell workspace={workspaceInfo(m)}>{children}</SettingsShell>;
}
