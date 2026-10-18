import "server-only";
import { HttpError } from "@/lib/api";
import { requireMember, type Membership } from "@/lib/workspaces";

/**
 * Connections and agent settings affect everyone in a workspace. In the open
 * demo workspace only its maintainers may change them; elsewhere any member can.
 */
export function canConfigure(m: Membership): boolean {
  return !m.workspace.open || m.role === "owner";
}

export async function requireConfigurer(slug: string): Promise<Membership> {
  const m = await requireMember(slug);
  if (!canConfigure(m)) throw new HttpError(403, "Only the demo's maintainers can change this");
  return m;
}
