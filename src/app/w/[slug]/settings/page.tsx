import { redirect } from "next/navigation";

export default async function SettingsHome({ params }: PageProps<"/w/[slug]/settings">) {
  const { slug } = await params;
  redirect(`/w/${encodeURIComponent(slug)}/settings/agent`);
}
