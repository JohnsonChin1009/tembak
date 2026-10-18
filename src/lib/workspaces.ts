import "server-only";
import { randomBytes } from "node:crypto";
import { HttpError, requireUser } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { kebab, randomId } from "@/lib/ids";
import { getStore } from "@/lib/store";
import { seedWorkspace } from "@/lib/store/seed";
import { DEMO_WORKSPACE_ID } from "@/lib/store/types";
import type { App, Member, Role, User, Workspace, WorkspaceInfo } from "@/lib/types";

export { DEMO_WORKSPACE_ID };

const MAX_CREATED_PER_USER = 10;

export type Membership = { user: User; workspace: Workspace; role: Role };

export function newInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

export function inviteUrl(ws: Workspace): string {
  return `${config().appUrl}/join/${ws.inviteToken}`;
}

/** Demo maintainers come from DEMO_OWNER_EMAILS; dev-mode users (no email) match "dev:<name>". */
export function isDemoOwner(user: User): boolean {
  const owners = config().demoOwners;
  if (user.email) return owners.includes(user.email.toLowerCase());
  return owners.includes(`dev:${user.name.trim().toLowerCase()}`);
}

function roleIn(ws: Workspace, user: User, member: Member): Role {
  if (ws.id === DEMO_WORKSPACE_ID && isDemoOwner(user)) return "owner";
  return member.role;
}

export function workspaceInfo(m: Membership): WorkspaceInfo {
  return { id: m.workspace.id, slug: m.workspace.slug, name: m.workspace.name, open: !!m.workspace.open, role: m.role };
}

/** Adds the user to the workspace (idempotent) and makes it their current one. */
export async function joinWorkspace(ws: Workspace, user: User, role: Role = "member"): Promise<Member> {
  const store = await getStore();
  const existing = await store.getMember(ws.id, user.uid);
  if (existing) return existing;
  const member: Member = {
    uid: user.uid,
    role,
    name: user.name,
    email: user.email,
    photoUrl: user.photoUrl,
    title: user.title,
    joinedAt: Date.now(),
  };
  await store.addMember(ws.id, member);
  await store.upsertUser({ ...user, lastWorkspaceId: ws.id });
  return member;
}

/**
 * Resolves the signed-in user's membership. Non-members get a 404 so workspace
 * names don't leak; open workspaces (the demo) let anyone in.
 */
export async function membership(user: User, ws: Workspace | null): Promise<Membership | null> {
  if (!ws) return null;
  const store = await getStore();
  let member = await store.getMember(ws.id, user.uid);
  if (!member && ws.open) member = await joinWorkspace(ws, user);
  if (!member) return null;
  return { user, workspace: ws, role: roleIn(ws, user, member) };
}

/** For API routes under /api/w/[ws]. */
export async function requireMember(slug: string): Promise<Membership> {
  const user = await requireUser();
  const m = await membership(user, await (await getStore()).getWorkspaceBySlug(slug));
  if (!m) throw new HttpError(404, "Workspace not found");
  return m;
}

export async function requireOwner(slug: string): Promise<Membership> {
  const m = await requireMember(slug);
  if (m.role !== "owner") throw new HttpError(403, "Only workspace owners can do that");
  return m;
}

/** For pages: null when signed out or not a member. */
export async function pageMembership(slug: string): Promise<Membership | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return membership(user, await (await getStore()).getWorkspaceBySlug(slug));
}

/** For the flat /api/apps/[id] routes: the app plus a membership check on its workspace. */
export async function requireAppAccess(appId: string): Promise<Membership & { app: App }> {
  const user = await requireUser();
  const store = await getStore();
  const app = await store.getApp(appId);
  const m = app ? await membership(user, await store.getWorkspace(app.workspaceId)) : null;
  if (!app || !m) throw new HttpError(404, "App not found");
  return { ...m, app };
}

export async function createWorkspace(name: string, user: User): Promise<Workspace> {
  const store = await getStore();
  const mine = (await store.listWorkspacesForUser(user.uid)).filter((w) => w.createdBy === user.uid);
  if (mine.length >= MAX_CREATED_PER_USER) {
    throw new HttpError(429, `You can create up to ${MAX_CREATED_PER_USER} workspaces`);
  }
  const clean = name.trim().slice(0, 40);
  const ws: Workspace = {
    id: `ws_${randomId(12)}`,
    slug: `${kebab(clean, 30)}-${randomId(4)}`,
    name: clean,
    createdAt: Date.now(),
    createdBy: user.uid,
    inviteToken: newInviteToken(),
  };
  await store.createWorkspace(ws);
  await seedWorkspace(store, ws.id, user.uid);
  await joinWorkspace(ws, user, "owner");
  return ws;
}

/** Where a signed-in user lands: their last workspace, else their first, else null (go to /new). */
export async function homeWorkspace(user: User): Promise<Workspace | null> {
  const store = await getStore();
  const [stored, list] = await Promise.all([store.getUser(user.uid), store.listWorkspacesForUser(user.uid)]);
  return list.find((w) => w.id === stored?.lastWorkspaceId) ?? list[0] ?? null;
}

export async function rememberWorkspace(user: User, ws: Workspace): Promise<void> {
  const store = await getStore();
  const stored = await store.getUser(user.uid);
  if (stored?.lastWorkspaceId !== ws.id) await store.upsertUser({ ...user, lastWorkspaceId: ws.id });
}
