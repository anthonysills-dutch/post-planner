import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { aiAvailable, assist, assistInput } from "@/server/ai";
import * as posts from "@/server/posts";
import { ensureProfile } from "@/server/profile";
import * as share from "@/server/share";

type Result = { ok: true } | { ok: false; error: string };

async function attempt(work: () => Promise<unknown>): Promise<Result> {
  try {
    await work();
    return { ok: true };
  } catch (error) {
    if (error instanceof posts.PostError) return { ok: false, error: error.message };
    throw error;
  }
}

const NOT_FOUND: Result = { ok: false, error: "Post not found." };

export const getBoard = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    await ensureProfile(context.user);
    return posts.listPosts(context.user.id);
  });

export const getEditor = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.idInput.parse(data))
  .handler(async ({ data, context }) => {
    const [profile, post, ai] = await Promise.all([
      ensureProfile(context.user),
      posts.getPost(context.user.id, data.id),
      aiAvailable(env),
    ]);
    return {
      post,
      profile: { displayName: profile.displayName, timeZone: profile.timeZone },
      ai,
      origin: new URL(getRequest().url).origin,
    };
  });

export const createPost = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.createPostInput.parse(data))
  .handler(async ({ data, context }) => {
    await ensureProfile(context.user);
    return posts.createPost(context.user.id, data);
  });

export const savePost = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.updatePostInput.parse(data))
  .handler(({ data, context }) =>
    attempt(async () => {
      if (!(await posts.updatePost(context.user.id, data))) throw new posts.PostError("Post not found.");
    }),
  );

export const duplicatePost = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.idInput.parse(data))
  .handler(({ data, context }) => posts.duplicatePost(context.user.id, data.id));

export const deletePost = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.idInput.parse(data))
  .handler(async ({ data, context }) =>
    (await posts.deletePost(context.user.id, data.id)) ? { ok: true as const } : NOT_FOUND,
  );

export const addToQueue = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.idInput.parse(data))
  .handler(async ({ data, context }) => {
    const profile = await ensureProfile(context.user);
    return attempt(() => posts.addToQueue(profile, data.id));
  });

export const scheduleAt = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.scheduleAtInput.parse(data))
  .handler(async ({ data, context }) => {
    const profile = await ensureProfile(context.user);
    return attempt(() => posts.scheduleAt(profile, data));
  });

export const unschedule = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.idInput.parse(data))
  .handler(async ({ data, context }) =>
    (await posts.unschedule(context.user.id, data.id)) ? { ok: true as const } : NOT_FOUND,
  );

export const saveMetrics = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.metricsInput.parse(data))
  .handler(async ({ data, context }) =>
    (await posts.updateMetrics(context.user.id, data)) ? { ok: true as const } : NOT_FOUND,
  );

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.idInput.parse(data))
  .handler(async ({ data, context }) => ({
    token: await share.createShareLink(context.user.id, data.id),
  }));

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => posts.idInput.parse(data))
  .handler(async ({ data, context }) => {
    await share.revokeShareLink(context.user.id, data.id);
    return { ok: true as const };
  });

export const askAi = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => assistInput.parse(data))
  .handler(({ data }) => assist(env, data));
