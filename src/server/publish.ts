import { and, eq, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import { posts, profiles } from "@/db/schema";
import { publishToLinkedIn } from "./linkedin";

const STALE = 10 * 60_000;

/** The minute cron: publishes every due post to its author's LinkedIn. */
export async function publishDue(env: object, now = Date.now()): Promise<void> {
  // A run that died mid-publish leaves its claim; say so rather than post twice.
  await db
    .update(posts)
    .set({
      status: "failed",
      publishingAt: null,
      failureReason: "Publishing didn't finish. Check LinkedIn before scheduling it again.",
    })
    .where(and(eq(posts.status, "scheduled"), lt(posts.publishingAt, now - STALE)));

  const due = await db
    .select({ id: posts.id, userId: posts.userId, body: posts.body, orgId: profiles.orgId })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.userId))
    .where(
      and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, now), isNull(posts.publishingAt)),
    )
    .limit(25);

  for (const post of due) {
    // Claim it in one statement so two runs never publish the same post.
    const [claimed] = await db
      .update(posts)
      .set({ publishingAt: now })
      .where(and(eq(posts.id, post.id), eq(posts.status, "scheduled"), isNull(posts.publishingAt)))
      .returning({ id: posts.id });
    if (!claimed) continue;
    const result = await publishToLinkedIn(env, post, post.body);
    await db
      .update(posts)
      .set(
        result.ok
          ? {
              status: "published",
              publishedAt: Date.now(),
              externalId: result.externalId,
              externalUrl: result.externalUrl,
              publishingAt: null,
              failureReason: null,
              updatedAt: Date.now(),
            }
          : { status: "failed", failureReason: result.reason, publishingAt: null, updatedAt: Date.now() },
      )
      .where(eq(posts.id, post.id));
  }
}
