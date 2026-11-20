import type { PostStatus } from "@/db/schema";

export const STATUS_LABELS: Record<PostStatus, string> = {
  idea: "Idea",
  draft: "Draft",
  ready: "Ready",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
};

export const STATUS_BADGE: Record<PostStatus, "outline" | "secondary" | "soft" | "success" | "destructive"> = {
  idea: "outline",
  draft: "secondary",
  ready: "soft",
  scheduled: "soft",
  published: "success",
  failed: "destructive",
};

/** The message of a failed call, as a sentence. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "That didn't work. Try again.";
}

export const BOARD_COLUMNS: readonly PostStatus[] = ["idea", "draft", "ready", "scheduled", "published", "failed"];
