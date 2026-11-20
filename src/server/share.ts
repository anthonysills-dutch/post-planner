import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, profiles, shareLinks } from "@/db/schema";

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** The post's preview token, made once; null when the member has no such post. */
export async function createShareLink(
  userId: string,
  postId: string,
): Promise<string | null> {
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)));
  if (!post) return null;
  await db
    .insert(shareLinks)
    .values({ token: newToken(), postId, userId })
    .onConflictDoNothing();
  const [link] = await db
    .select({ token: shareLinks.token })
    .from(shareLinks)
    .where(and(eq(shareLinks.postId, postId), eq(shareLinks.userId, userId)));
  return link?.token ?? null;
}

export async function revokeShareLink(userId: string, postId: string): Promise<void> {
  await db
    .delete(shareLinks)
    .where(and(eq(shareLinks.postId, postId), eq(shareLinks.userId, userId)));
}

/** What a preview link shows: the author's display name and the current body, nothing else. */
export async function getSharedPost(
  token: string,
): Promise<{ authorName: string; body: string } | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await db
    .select({ authorName: profiles.displayName, body: posts.body })
    .from(shareLinks)
    .innerJoin(
      posts,
      and(eq(posts.id, shareLinks.postId), eq(posts.userId, shareLinks.userId)),
    )
    .innerJoin(profiles, eq(profiles.userId, posts.userId))
    .where(eq(shareLinks.token, token));
  return row ?? null;
}
