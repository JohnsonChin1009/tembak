import { ConnectorSettings } from "@/components/settings/connector-settings";

export default async function ConnectorSettingsPage({ searchParams }: PageProps<"/w/[slug]/settings/connectors">) {
  const query = await searchParams;
  const provider = query.connected ?? query.provider;
  const error = query.connect_error;
  return (
    <ConnectorSettings
      returned={typeof provider === "string" ? { provider, error: typeof error === "string" ? error : null } : null}
    />
  );
}
