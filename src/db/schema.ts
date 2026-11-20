import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

/** One row per member, keyed by the Gateway's user id, made on first sight. */
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  orgId: text("org_id").notNull(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  timeZone: text("time_zone").notNull().default("UTC"),
  weeklyGoal: integer("weekly_goal").notNull().default(3),
  createdAt: createdAt(),
});

/** A weekly posting time: weekday 1 (Monday) to 7, minutes after midnight in the member's time zone. */
export const slots = sqliteTable(
  "slots",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    weekday: integer("weekday").notNull(),
    minute: integer("minute").notNull(),
  },
  (t) => [uniqueIndex("slots_user_time").on(t.userId, t.weekday, t.minute)],
);

export const POST_STATUSES = [
  "idea",
  "draft",
  "ready",
  "scheduled",
  "published",
  "failed",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

/** A post, private to its author. Times are epoch milliseconds. */
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    body: text("body").notNull().default(""),
    status: text("status", { enum: POST_STATUSES }).notNull(),
    scheduledAt: integer("scheduled_at"),
    publishingAt: integer("publishing_at"),
    publishedAt: integer("published_at"),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    failureReason: text("failure_reason"),
    impressions: integer("impressions").notNull().default(0),
    reactions: integer("reactions").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    reposts: integer("reposts").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("posts_user_status").on(t.userId, t.status),
    index("posts_due").on(t.status, t.scheduledAt),
  ],
);

/** A read-only preview link to one post. The token is the only key. */
export const shareLinks = sqliteTable(
  "share_links",
  {
    token: text("token").primaryKey(),
    postId: text("post_id").notNull(),
    userId: text("user_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("share_links_post").on(t.postId)],
);

/** The organization's shared library of example posts. */
export const libraryEntries = sqliteTable(
  "library_entries",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    addedBy: text("added_by").notNull(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    topic: text("topic").notNull(),
    likes: integer("likes").notNull().default(0),
    comments: integer("comments").notNull().default(0),
    sourceUrl: text("source_url"),
    createdAt: createdAt(),
  },
  (t) => [index("library_org").on(t.orgId)],
);

/** A member's private, named set of library entries. */
export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const collectionItems = sqliteTable(
  "collection_items",
  {
    collectionId: text("collection_id").notNull(),
    entryId: text("entry_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.entryId] })],
);
