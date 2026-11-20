import { and, asc, desc, eq, gte, inArray, isNotNull, lt, ne, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { posts, shareLinks, slots, type PostStatus } from "@/db/schema";
import { nextFreeSlot, parseLocal } from "./time";
import type { Profile } from "./profile";

export const MAX_LENGTH = 3000;
/** The statuses a member moves a post between by hand. */
export const WORKING = ["idea", "draft", "ready"] as const;

/** A message the page shows as it is. */
export class PostError extends Error {}

const id = z.string().uuid();
export const idInput = z.object({ id }).strict();

export interface PostSummary {
  id: string;
  body: string;
  status: PostStatus;
  scheduledAt: number | null;
  publishedAt: number | null;
  updatedAt: number;
}

const summary = {
  id: posts.id,
  body: posts.body,
  status: posts.status,
  scheduledAt: posts.scheduledAt,
  publishedAt: posts.publishedAt,
  updatedAt: posts.updatedAt,
};

export function listPosts(userId: string): Promise<PostSummary[]> {
  return db
    .select(summary)
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.updatedAt));
}

export async function getPost(userId: string, postId: string) {
  const [row] = await db
    .select({
      ...summary,
      externalUrl: posts.externalUrl,
      failureReason: posts.failureReason,
      impressions: posts.impressions,
      reactions: posts.reactions,
      comments: posts.comments,
      reposts: posts.reposts,
      shareToken: shareLinks.token,
    })
    .from(posts)
    .leftJoin(shareLinks, eq(shareLinks.postId, posts.id))
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));
  return row ?? null;
}
export type Post = NonNullable<Awaited<ReturnType<typeof getPost>>>;

export const createPostInput = z
  .object({
    body: z.string().max(MAX_LENGTH).optional(),
    status: z.enum(WORKING).optional(),
  })
  .strict();

export async function createPost(
  userId: string,
  input: z.infer<typeof createPostInput>,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(posts)
    .values({
      id: crypto.randomUUID(),
      userId,
      body: input.body ?? "",
      status: input.status ?? "draft",
      updatedAt: Date.now(),
    })
    .returning({ id: posts.id });
  return row!;
}

export const updatePostInput = z
  .object({
    id,
    body: z.string().max(MAX_LENGTH, `At most ${MAX_LENGTH} characters`),
    status: z.enum(WORKING).optional(),
  })
  .strict();

/** Saves the body, and moves the post to Idea, Draft or Ready (which unschedules it). Published posts don't change. */
export async function updatePost(
  userId: string,
  { id: postId, body, status }: z.infer<typeof updatePostInput>,
): Promise<boolean> {
  const current = await getPost(userId, postId);
  if (!current) return false;
  if (current.status === "published")
    throw new PostError("Published posts can't be edited.");
  const move = status && status !== current.status;
  const [row] = await db
    .update(posts)
    .set({
      body,
      updatedAt: Date.now(),
      ...(move
        ? { status, scheduledAt: null, failureReason: null, publishingAt: null }
        : {}),
    })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.userId, userId),
        ne(posts.status, "published"),
      ),
    )
    .returning({ id: posts.id });
  return Boolean(row);
}

export async function duplicatePost(
  userId: string,
  postId: string,
): Promise<{ id: string } | null> {
  const current = await getPost(userId, postId);
  if (!current) return null;
  return createPost(userId, { body: current.body, status: "draft" });
}

export async function deletePost(userId: string, postId: string): Promise<boolean> {
  const [row] = await db
    .delete(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .returning({ id: posts.id });
  if (!row) return false;
  await db.delete(shareLinks).where(eq(shareLinks.postId, postId));
  return true;
}

function assertSchedulable(post: Post | null): asserts post is Post {
  if (!post) throw new PostError("Post not found.");
  if (post.status === "published")
    throw new PostError("This post is already published.");
  if (post.status === "idea")
    throw new PostError("Move the idea to Draft or Ready first.");
  if (!post.body.trim()) throw new PostError("Write the post first.");
}

async function setSchedule(userId: string, postId: string, at: number) {
  await db
    .update(posts)
    .set({
      status: "scheduled",
      scheduledAt: at,
      failureReason: null,
      publishingAt: null,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.userId, userId),
        inArray(posts.status, ["draft", "ready", "failed", "scheduled"]),
      ),
    );
}

/** Puts the post in the member's next free slot after now. */
export async function addToQueue(
  profile: Profile,
  postId: string,
  now = Date.now(),
): Promise<number> {
  const post = await getPost(profile.userId, postId);
  assertSchedulable(post);
  const [weekly, held] = await Promise.all([
    db
      .select({ weekday: slots.weekday, minute: slots.minute })
      .from(slots)
      .where(eq(slots.userId, profile.userId)),
    db
      .select({ at: posts.scheduledAt })
      .from(posts)
      .where(
        and(
          eq(posts.userId, profile.userId),
          eq(posts.status, "scheduled"),
          ne(posts.id, postId),
        ),
      ),
  ]);
  if (weekly.length === 0)
    throw new PostError("Add posting times in Settings first.");
  const taken = new Set(held.map((row) => row.at ?? 0));
  const at = nextFreeSlot(weekly, profile.timeZone, now, taken);
  if (at === null)
    throw new PostError("Every slot in the next eight weeks is taken.");
  await setSchedule(profile.userId, postId, at);
  return at;
}

export const scheduleAtInput = z
  .object({ id, at: z.string().min(1, "Pick a date and time") })
  .strict();

export async function scheduleAt(
  profile: Profile,
  { id: postId, at }: z.infer<typeof scheduleAtInput>,
  now = Date.now(),
): Promise<number> {
  const post = await getPost(profile.userId, postId);
  assertSchedulable(post);
  const when = parseLocal(at, profile.timeZone);
  if (when === null) throw new PostError("Pick a date and time.");
  if (when <= now) throw new PostError("Pick a time in the future.");
  await setSchedule(profile.userId, postId, when);
  return when;
}

export async function unschedule(userId: string, postId: string): Promise<boolean> {
  const [row] = await db
    .update(posts)
    .set({ status: "ready", scheduledAt: null, updatedAt: Date.now() })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.userId, userId),
        eq(posts.status, "scheduled"),
      ),
    )
    .returning({ id: posts.id });
  return Boolean(row);
}

const count = z.number().int().min(0).max(1_000_000_000);
export const metricsInput = z
  .object({ id, impressions: count, reactions: count, comments: count, reposts: count })
  .strict();

export async function updateMetrics(
  userId: string,
  { id: postId, ...numbers }: z.infer<typeof metricsInput>,
): Promise<boolean> {
  const [row] = await db
    .update(posts)
    .set(numbers)
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.userId, userId),
        eq(posts.status, "published"),
      ),
    )
    .returning({ id: posts.id });
  return Boolean(row);
}

/** Scheduled posts from `from` on, soonest first. */
export function listUpcoming(userId: string, from: number) {
  return db
    .select(summary)
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        eq(posts.status, "scheduled"),
        gte(posts.scheduledAt, from),
      ),
    )
    .orderBy(asc(posts.scheduledAt));
}

/** Scheduled and published posts with a time in [from, to). */
export function listBetween(userId: string, from: number, to: number) {
  return db
    .select(summary)
    .from(posts)
    .where(
      and(
        eq(posts.userId, userId),
        or(
          and(
            eq(posts.status, "scheduled"),
            gte(posts.scheduledAt, from),
            lt(posts.scheduledAt, to),
          ),
          and(
            eq(posts.status, "published"),
            isNotNull(posts.publishedAt),
            gte(posts.publishedAt, from),
            lt(posts.publishedAt, to),
          ),
        ),
      ),
    );
}

/** Published posts with their numbers. */
export function listPublished(userId: string) {
  return db
    .select({
      id: posts.id,
      body: posts.body,
      publishedAt: posts.publishedAt,
      impressions: posts.impressions,
      reactions: posts.reactions,
      comments: posts.comments,
      reposts: posts.reposts,
    })
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.status, "published")))
    .orderBy(desc(posts.publishedAt));
}
