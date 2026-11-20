import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { collectionItems, collections, libraryEntries } from "@/db/schema";

const id = z.string().uuid();
export const idInput = z.object({ id }).strict();

export function listEntries(orgId: string) {
  return db
    .select({
      id: libraryEntries.id,
      addedBy: libraryEntries.addedBy,
      authorName: libraryEntries.authorName,
      body: libraryEntries.body,
      topic: libraryEntries.topic,
      likes: libraryEntries.likes,
      comments: libraryEntries.comments,
      sourceUrl: libraryEntries.sourceUrl,
      createdAt: libraryEntries.createdAt,
    })
    .from(libraryEntries)
    .where(eq(libraryEntries.orgId, orgId));
}
export type Entry = Awaited<ReturnType<typeof listEntries>>[number];

const count = z.number().int().min(0).max(1_000_000_000);
export const addEntryInput = z
  .object({
    authorName: z.string().trim().min(1, "Enter the author").max(120),
    body: z.string().trim().min(1, "Paste the post").max(5000),
    topic: z.string().trim().min(1, "Enter a topic").max(60),
    likes: count,
    comments: count,
    sourceUrl: z
      .string()
      .trim()
      .max(2000)
      .refine((v) => v === "" || /^https?:\/\//.test(v), "Enter a web address")
      .optional(),
  })
  .strict();

export async function addEntry(
  orgId: string,
  userId: string,
  input: z.infer<typeof addEntryInput>,
): Promise<void> {
  await db.insert(libraryEntries).values({
    id: crypto.randomUUID(),
    orgId,
    addedBy: userId,
    ...input,
    sourceUrl: input.sourceUrl || null,
  });
}

/** Deletes an entry the member added, or any entry when they are an admin. */
export async function deleteEntry(
  orgId: string,
  userId: string,
  admin: boolean,
  entryId: string,
): Promise<boolean> {
  const [row] = await db
    .delete(libraryEntries)
    .where(
      and(
        eq(libraryEntries.id, entryId),
        eq(libraryEntries.orgId, orgId),
        ...(admin ? [] : [eq(libraryEntries.addedBy, userId)]),
      ),
    )
    .returning({ id: libraryEntries.id });
  if (!row) return false;
  await db.delete(collectionItems).where(eq(collectionItems.entryId, entryId));
  return true;
}

export async function getEntry(orgId: string, entryId: string) {
  const [row] = await db
    .select({ body: libraryEntries.body })
    .from(libraryEntries)
    .where(and(eq(libraryEntries.id, entryId), eq(libraryEntries.orgId, orgId)));
  return row ?? null;
}

// Collections: private to their owner.

export async function listCollections(userId: string, orgId: string) {
  const owned = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(eq(collections.userId, userId))
    .orderBy(asc(collections.name));
  if (owned.length === 0) return [];
  const items = await db
    .select({
      collectionId: collectionItems.collectionId,
      entryId: libraryEntries.id,
      authorName: libraryEntries.authorName,
      body: libraryEntries.body,
      topic: libraryEntries.topic,
    })
    .from(collectionItems)
    .innerJoin(libraryEntries, eq(libraryEntries.id, collectionItems.entryId))
    .where(
      and(
        inArray(
          collectionItems.collectionId,
          owned.map((c) => c.id),
        ),
        eq(libraryEntries.orgId, orgId),
      ),
    )
    .orderBy(asc(collectionItems.createdAt));
  return owned.map((collection) => ({
    ...collection,
    entries: items.filter((item) => item.collectionId === collection.id),
  }));
}

const name = z.string().trim().min(1, "Enter a name").max(80);
export const createCollectionInput = z.object({ name }).strict();
export const renameCollectionInput = z.object({ id, name }).strict();
export const itemInput = z.object({ collectionId: id, entryId: id }).strict();

export async function createCollection(userId: string, collectionName: string) {
  await db
    .insert(collections)
    .values({ id: crypto.randomUUID(), userId, name: collectionName });
}

export async function renameCollection(
  userId: string,
  collectionId: string,
  collectionName: string,
): Promise<boolean> {
  const [row] = await db
    .update(collections)
    .set({ name: collectionName })
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .returning({ id: collections.id });
  return Boolean(row);
}

export async function deleteCollection(userId: string, collectionId: string) {
  const [row] = await db
    .delete(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .returning({ id: collections.id });
  if (row)
    await db
      .delete(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));
  return Boolean(row);
}

async function ownsCollection(userId: string, collectionId: string) {
  const [row] = await db
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  return Boolean(row);
}

export async function addToCollection(
  userId: string,
  orgId: string,
  { collectionId, entryId }: z.infer<typeof itemInput>,
): Promise<boolean> {
  if (!(await ownsCollection(userId, collectionId))) return false;
  if (!(await getEntry(orgId, entryId))) return false;
  await db
    .insert(collectionItems)
    .values({ collectionId, entryId })
    .onConflictDoNothing();
  return true;
}

export async function removeFromCollection(
  userId: string,
  { collectionId, entryId }: z.infer<typeof itemInput>,
): Promise<boolean> {
  if (!(await ownsCollection(userId, collectionId))) return false;
  await db
    .delete(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.entryId, entryId),
      ),
    );
  return true;
}
