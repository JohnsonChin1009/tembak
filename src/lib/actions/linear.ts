import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { withAccessToken } from "@/lib/connectors/connections";
import { authHeader, gql, linearRefresh } from "@/lib/connectors/linear";
import { invalidateSourceRows } from "@/lib/data/fetch";
import { SourceFetchError } from "@/lib/data/errors";
import { getStore } from "@/lib/store";
import { action, requireConnection } from "./shared";

// Linear writes. The token only reaches the connected organization, so that's the
// scope: any team in it. Ids may be UUIDs or identifiers like "ENG-123".

type Gql = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
type IssueRef = { id: string; identifier: string; url: string };

const RECONNECT = "Reconnect Linear from the Data panel to allow Tembak to make changes.";

async function linear<T>(workspaceId: string, fn: (q: Gql) => Promise<T>): Promise<T> {
  await requireConnection(workspaceId, "linear");
  try {
    return await withAccessToken(workspaceId, "linear", linearRefresh, (token, conn) =>
      fn((query, variables) => gql(authHeader(token, conn), query, variables)),
    );
  } catch (err) {
    // Connections made before the write scope existed hold read-only tokens.
    if (err instanceof SourceFetchError && /scope|forbidden|read.?only/i.test(err.message)) throw new HttpError(403, RECONNECT);
    throw err;
  }
}

/** Issue lists read through the cache; drop it so tembak.data shows the change. */
async function invalidateLinear(workspaceId: string) {
  const sources = await (await getStore()).listSources(workspaceId);
  for (const s of sources) if (s.kind === "linear") invalidateSourceRows(s.id);
}

async function teamByKey(q: Gql, key: string) {
  const data = await q<{ teams: { nodes: { id: string; key: string }[] } }>(
    `query Team($key: String!) { teams(filter: { key: { eqIgnoreCase: $key } }, first: 1) { nodes { id key } } }`,
    { key },
  );
  const team = data.teams.nodes[0];
  if (!team) throw new HttpError(404, `Linear says the team ${key} doesn't exist.`);
  return team;
}

async function userByEmail(q: Gql, email: string): Promise<string> {
  const data = await q<{ users: { nodes: { id: string }[] } }>(
    `query User($email: String!) { users(filter: { email: { eqIgnoreCase: $email } }, first: 1) { nodes { id } } }`,
    { email },
  );
  const user = data.users.nodes[0];
  if (!user) throw new HttpError(404, `Linear has no one with the email ${email}.`);
  return user.id;
}

async function labelIds(q: Gql, teamId: string, names: string[]): Promise<string[]> {
  const data = await q<{ issueLabels: { nodes: { id: string; name: string; team: { id: string } | null }[] } }>(
    `query { issueLabels(first: 250) { nodes { id name team { id } } } }`,
  );
  const usable = data.issueLabels.nodes.filter((l) => !l.team || l.team.id === teamId);
  return names.map((name) => {
    const label = usable.find((l) => l.name.toLowerCase() === name.trim().toLowerCase());
    if (!label) throw new HttpError(404, `Linear has no label "${name}" for that team.`);
    return label.id;
  });
}

type IssueWithTeam = IssueRef & { team: { id: string; states: { nodes: { id: string; name: string }[] } } };

async function issueById(q: Gql, id: string): Promise<IssueWithTeam> {
  try {
    const data = await q<{ issue: IssueWithTeam | null }>(
      `query Issue($id: String!) { issue(id: $id) { id identifier url team { id states(first: 100) { nodes { id name } } } } }`,
      { id },
    );
    if (data.issue) return data.issue;
  } catch (err) {
    if (!(err instanceof SourceFetchError && /not found|entity/i.test(err.message))) throw err;
  }
  throw new HttpError(404, `Linear says the issue ${id} doesn't exist.`);
}

function mutated<T>(result: { success: boolean } & T, what: string): T {
  if (!result.success) throw new HttpError(502, `Linear couldn't ${what}. Try again.`);
  return result;
}

const priority = z.number().int().min(0).max(4);
const issueId = z.string().trim().min(1).max(64);

export const LINEAR_ACTIONS = {
  "linear.createIssue": action({
    provider: "linear",
    input: z.strictObject({
      teamKey: z.string().trim().min(1).max(20),
      title: z.string().trim().min(1).max(255),
      description: z.string().max(10_000).optional(),
      priority: priority.optional(),
      assigneeEmail: z.email().optional(),
      labelNames: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
    }),
    run: async (input, ctx) => {
      const issue = await linear(ctx.workspaceId, async (q) => {
        const team = await teamByKey(q, input.teamKey);
        const data = await q<{ issueCreate: { success: boolean; issue: IssueRef } }>(
          `mutation Create($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }`,
          {
            input: {
              teamId: team.id,
              title: input.title,
              description: input.description,
              priority: input.priority,
              assigneeId: input.assigneeEmail ? await userByEmail(q, input.assigneeEmail) : undefined,
              labelIds: input.labelNames?.length ? await labelIds(q, team.id, input.labelNames) : undefined,
            },
          },
        );
        return mutated(data.issueCreate, "create the issue").issue;
      });
      await invalidateLinear(ctx.workspaceId);
      return { id: issue.id, identifier: issue.identifier, url: issue.url };
    },
  }),

  "linear.updateIssue": action({
    provider: "linear",
    input: z
      .strictObject({
        id: issueId,
        stateName: z.string().trim().min(1).max(80).optional(),
        priority: priority.optional(),
        // null unassigns.
        assigneeEmail: z.email().nullable().optional(),
        title: z.string().trim().min(1).max(255).optional(),
      })
      .refine(
        (i) => i.stateName !== undefined || i.priority !== undefined || i.assigneeEmail !== undefined || i.title !== undefined,
        "Say what to change: stateName, priority, assigneeEmail, or title",
      ),
    run: async (input, ctx) => {
      const issue = await linear(ctx.workspaceId, async (q) => {
        const current = await issueById(q, input.id);
        let stateId: string | undefined;
        if (input.stateName) {
          const state = current.team.states.nodes.find((s) => s.name.toLowerCase() === input.stateName!.toLowerCase());
          if (!state) {
            const names = current.team.states.nodes.map((s) => s.name).join(", ");
            throw new HttpError(404, `Linear has no state "${input.stateName}" for ${current.identifier}. Try one of: ${names}.`);
          }
          stateId = state.id;
        }
        const assigneeId =
          input.assigneeEmail === undefined ? undefined : input.assigneeEmail === null ? null : await userByEmail(q, input.assigneeEmail);
        const data = await q<{ issueUpdate: { success: boolean; issue: IssueRef } }>(
          `mutation Update($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id identifier url } } }`,
          { id: current.id, input: { stateId, priority: input.priority, assigneeId, title: input.title } },
        );
        return mutated(data.issueUpdate, "update the issue").issue;
      });
      await invalidateLinear(ctx.workspaceId);
      return { id: issue.id, identifier: issue.identifier, url: issue.url };
    },
  }),

  "linear.comment": action({
    provider: "linear",
    input: z.strictObject({ issueId, body: z.string().trim().min(1).max(10_000) }),
    run: async (input, ctx) =>
      linear(ctx.workspaceId, async (q) => {
        const issue = await issueById(q, input.issueId);
        const data = await q<{ commentCreate: { success: boolean; comment: { id: string } } }>(
          `mutation Comment($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id } } }`,
          { input: { issueId: issue.id, body: input.body } },
        );
        return { id: mutated(data.commentCreate, "add the comment").comment.id };
      }),
  }),
};
