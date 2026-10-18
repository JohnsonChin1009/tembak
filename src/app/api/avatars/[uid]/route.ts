import { handle, HttpError, requireUser } from "@/lib/api";
import { getStore } from "@/lib/store";

/** Uploaded profile pictures. URLs carry ?v=<updatedAt>, so responses can cache for good. */
export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/avatars/[uid]">) => {
  await requireUser();
  const avatar = await (await getStore()).getAvatar((await ctx.params).uid);
  if (!avatar) throw new HttpError(404, "No picture");
  return new Response(Buffer.from(avatar.data, "base64"), {
    headers: {
      "content-type": avatar.contentType,
      "cache-control": "private, max-age=31536000, immutable",
    },
  });
});
