import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { pageMembership } from "@/lib/workspaces";

export default async function WorkspaceHome({ params }: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const m = await pageMembership(slug);
  if (!m) notFound();
  const channels = await (await getStore()).listChannels(m.workspace.id);
  redirect(`/w/${slug}/c/${channels[0]?.id ?? "general"}`);
}
