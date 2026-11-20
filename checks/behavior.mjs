// Behavior: each feature's main path, through the packaged release.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { fakeGateway, SUGGESTION } from "./fake-gateway.mjs";

const runtime = await startRuntime(fakeGateway);
const sql = async (query, ...values) => (await runtime.database()).prepare(query).bind(...values).run();
const postIdOf = (page) => new URL(page.url()).pathname.split("/").pop();

async function selectOption(page, triggerId, name) {
  await page.getByTestId(triggerId).click();
  await page.getByRole("option", { name, exact: true }).click();
}

async function newPost(page, body) {
  await page.goto("/");
  await Promise.all([page.waitForURL(/\/posts\/[0-9a-f-]{36}$/), page.getByTestId("new-post").click()]);
  await page.getByTestId("post-body").fill(body);
  await page.getByTestId("save-post").click();
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  return postIdOf(page);
}

try {
  // Server routes answer members.
  expect((await runtime.fetch("/", { role: "owner" })).status).toBe(200);

  const context = await runtime.context("owner");
  const page = await context.newPage();

  // F003 settings: display name, time zone, goal and weekly slots.
  await page.goto("/settings");
  await runtime.assertBackLink(page);
  await page.getByTestId("display-name").fill("Maya Ortiz");
  await page.getByTestId("weekly-goal").fill("3");
  await selectOption(page, "timezone", "UTC");
  await page.getByTestId("save-settings").click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await selectOption(page, "slot-day", "Every day");
  await page.getByTestId("slot-time").fill("09:00");
  await page.getByTestId("add-slot").click();
  await expect(page.getByTestId("slot-row")).toHaveCount(7);
  await expect(page.getByTestId("linkedin-status")).toBeVisible();

  // F001 editor: live preview, count, status and the board.
  await page.goto("/");
  await runtime.assertBackLink(page);
  await expect(page.getByRole("heading", { level: 1, name: "Posts" })).toBeVisible();
  for (const status of ["idea", "draft", "ready", "scheduled", "published", "failed"]) {
    await expect(page.getByTestId(`column-${status}`)).toBeVisible();
  }
  await Promise.all([page.waitForURL(/\/posts\/[0-9a-f-]{36}$/), page.getByTestId("new-post").click()]);
  const mainId = postIdOf(page);
  const firstBody = "We cut our weekly status meeting to 15 minutes.\n\nHere is what we kept and what we dropped.";
  await page.getByTestId("post-body").fill(firstBody);
  await expect(page.getByTestId("char-count")).toHaveText(`${firstBody.length} / 3000`);
  await expect(page.getByTestId("post-preview")).toContainText("We cut our weekly status meeting");
  await expect(page.getByTestId("preview-author")).toHaveText("Maya Ortiz");
  await page.getByTestId("post-body").fill("x".repeat(3001));
  await expect(page.getByTestId("char-count")).toHaveText("3001 / 3000");
  await expect(page.getByTestId("save-post")).toBeDisabled();
  await page.getByTestId("post-body").fill(firstBody);
  await page.getByTestId("status-ready").click();
  await page.getByTestId("save-post").click();
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await page.goto("/");
  await expect(page.getByTestId("column-ready").getByTestId("post-card")).toContainText(["We cut our weekly status meeting"]);
  await page.goto(`/posts/${mainId}`);
  await page.getByTestId("status-idea").click();
  await page.getByTestId("save-post").click();
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await page.goto("/");
  await expect(page.getByTestId("column-idea")).toContainText("We cut our weekly status meeting");

  // F002 AI help: a suggestion is accepted or discarded, never saved on its own.
  await page.goto(`/posts/${mainId}`);
  await page.getByTestId("ai-idea").fill("why short planning meetings work");
  await page.getByTestId("ai-draft").click();
  await expect(page.getByTestId("ai-suggestion")).toContainText(SUGGESTION);
  await expect(page.getByTestId("post-body")).toHaveValue(firstBody);
  await page.getByTestId("ai-discard").click();
  await expect(page.getByTestId("ai-suggestion")).toHaveCount(0);
  await expect(page.getByTestId("post-body")).toHaveValue(firstBody);
  await page.getByTestId("ai-shorten").click();
  await expect(page.getByTestId("ai-suggestion")).toContainText(SUGGESTION);
  await page.getByTestId("ai-discard").click();
  await page.getByTestId("ai-hook").click();
  await expect(page.getByTestId("ai-suggestion")).toBeVisible();
  await page.getByTestId("ai-discard").click();
  await page.getByTestId("ai-tone").click();
  await page.getByRole("menuitem", { name: "Storytelling" }).click();
  await expect(page.getByTestId("ai-suggestion")).toContainText(SUGGESTION);
  await page.getByTestId("ai-accept").click();
  await expect(page.getByTestId("post-body")).toHaveValue(SUGGESTION);
  await page.reload();
  await expect(page.getByTestId("post-body")).toHaveValue(firstBody);
  await page.getByTestId("ai-idea").fill("why short planning meetings work");
  await page.getByTestId("ai-draft").click();
  await page.getByTestId("ai-accept").click();
  await page.getByTestId("status-ready").click();
  await page.getByTestId("save-post").click();
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByTestId("post-body")).toHaveValue(SUGGESTION);

  // F006 preview link: anyone with it sees the current body; revoked is not found.
  await page.getByTestId("create-share-link").click();
  const shareUrl = (await page.getByTestId("share-link").inputValue()).trim();
  expect(new URL(shareUrl).hostname).toBe(runtime.hostname);
  const sharePath = new URL(shareUrl).pathname;
  expect(sharePath).toMatch(/^\/s\/[A-Za-z0-9_-]{16,}$/);
  const visitor = await (await runtime.context(null)).newPage();
  await visitor.goto(sharePath);
  await expect(visitor.getByTestId("shared-author")).toHaveText("Maya Ortiz");
  await expect(visitor.getByTestId("shared-body")).toContainText("Most teams plan too much");
  const anonymous = await runtime.fetch(sharePath);
  expect(anonymous.status).toBe(200);
  expect(await anonymous.text()).toContain("Most teams plan too much");
  const editedBody = `${SUGGESTION}\n\nWhat does your team's weekly plan look like?`;
  await page.getByTestId("post-body").fill(editedBody);
  await page.getByTestId("save-post").click();
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await visitor.reload();
  await expect(visitor.getByTestId("shared-body")).toContainText("What does your team's weekly plan look like?");

  // F003 queue: next free slot, unschedule, exact time, move.
  await page.getByTestId("add-to-queue").click();
  await expect(page.getByTestId("post-status")).toHaveText("Scheduled");
  await expect(page.getByTestId("scheduled-for")).toContainText("09:00");
  await page.goto("/queue");
  await runtime.assertBackLink(page);
  await expect(page.getByTestId("queue-post").first()).toContainText("Most teams plan too much");
  await expect(page.getByTestId("queue-empty-slot").first()).toBeVisible();
  await page.goto("/calendar");
  await expect(page.getByTestId("calendar-post").first()).toContainText("Most teams plan too much");
  await page.goto(`/posts/${mainId}`);
  await page.getByTestId("unschedule").click();
  await expect(page.getByTestId("post-status")).toHaveText("Ready");
  const future = new Date(Date.now() + 3 * 86400000);
  const local = `${future.toISOString().slice(0, 10)}T14:30`;
  await page.getByTestId("schedule-at-input").fill(local);
  await page.getByTestId("schedule-at").click();
  await expect(page.getByTestId("post-status")).toHaveText("Scheduled");
  await expect(page.getByTestId("scheduled-for")).toContainText("14:30");
  await page.getByTestId("schedule-at-input").fill(`${future.toISOString().slice(0, 10)}T16:45`);
  await page.getByTestId("schedule-at").click();
  await expect(page.getByTestId("scheduled-for")).toContainText("16:45");
  await page.getByTestId("schedule-at-input").fill("2020-01-01T10:00");
  await page.getByTestId("schedule-at").click();
  await expect(page.getByText("Pick a time in the future")).toBeVisible();

  // F003 publishing: a due post without a LinkedIn connection fails with a reason, and can be queued again.
  await sql("UPDATE posts SET scheduled_at = ? WHERE id = ?", Date.now() - 60000, mainId);
  await runtime.scheduled("* * * * *");
  await page.reload();
  await expect(page.getByTestId("post-status")).toHaveText("Failed");
  await expect(page.getByTestId("failure-reason")).toContainText("LinkedIn");
  await page.getByTestId("add-to-queue").click();
  await expect(page.getByTestId("post-status")).toHaveText("Scheduled");

  // F001 duplicate and delete.
  await Promise.all([page.waitForURL((url) => !url.pathname.endsWith(mainId)), page.getByTestId("duplicate-post").click()]);
  await expect(page.getByTestId("post-body")).toHaveValue(editedBody);
  await expect(page.getByTestId("post-status")).toHaveText("Draft");
  await page.getByTestId("delete-post").click();
  await Promise.all([page.waitForURL((url) => url.pathname === "/"), page.getByRole("button", { name: "Delete", exact: true }).click()]);
  await expect(page.getByTestId("post-card").filter({ hasText: "Most teams plan too much" })).toHaveCount(1);

  // F001 published posts are read-only except numbers; F005 stats.
  const publishedId = await newPost(page, "Three things I learned shipping our first public roadmap.");
  const day = 86400000;
  await sql("UPDATE posts SET status = 'published', published_at = ?, external_id = 'urn:li:share:1', external_url = 'https://www.linkedin.com/feed/update/urn:li:share:1' WHERE id = ?", Date.now() - day, publishedId);
  const olderId = await newPost(page, "Hiring our first designer: the questions that mattered.");
  await sql("UPDATE posts SET status = 'published', published_at = ? WHERE id = ?", Date.now() - 8 * day, olderId);
  await page.goto(`/posts/${publishedId}`);
  await expect(page.getByTestId("post-status")).toHaveText("Published");
  await expect(page.getByTestId("post-body")).toHaveCount(0);
  await expect(page.getByTestId("post-body-readonly")).toContainText("public roadmap");
  await expect(page.getByTestId("published-link")).toHaveAttribute("href", /linkedin\.com/);
  await page.getByTestId("metric-impressions").fill("4200");
  await page.getByTestId("metric-reactions").fill("180");
  await page.getByTestId("metric-comments").fill("32");
  await page.getByTestId("metric-reposts").fill("9");
  await page.getByTestId("save-metrics").click();
  await expect(page.getByText("Numbers saved")).toBeVisible();
  await page.goto(`/posts/${olderId}`);
  await page.getByTestId("metric-impressions").fill("1500");
  await page.getByTestId("metric-reactions").fill("40");
  await page.getByTestId("save-metrics").click();
  await expect(page.getByText("Numbers saved")).toBeVisible();
  await page.goto("/stats");
  await expect(page.getByTestId("stat-impressions")).toHaveText("5,700");
  await expect(page.getByTestId("stat-reactions")).toHaveText("220");
  await expect(page.getByTestId("stat-comments")).toHaveText("32");
  await expect(page.getByTestId("stat-reposts")).toHaveText("9");
  await expect(page.getByTestId("stat-goal")).toContainText("3");
  await expect(page.getByTestId("stat-streak")).toBeVisible();
  await expect(page.getByTestId("week-bar").first()).toBeVisible();
  await expect(page.getByTestId("stats-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Impressions" }).click();
  await expect(page.getByTestId("stats-row").first()).toContainText(/roadmap|designer/);
  const firstAfterOne = await page.getByTestId("stats-row").first().textContent();
  await page.getByRole("button", { name: "Impressions" }).click();
  expect(await page.getByTestId("stats-row").first().textContent()).not.toBe(firstAfterOne);
  await page.goto("/calendar");
  await expect(page.getByTestId("calendar-post").filter({ hasText: "public roadmap" })).toHaveCount(1);

  // F004 library: add, search, filter, sort, collections, remix.
  await page.goto("/library");
  await runtime.assertBackLink(page);
  const entries = [
    ["Priya Natarajan", "Leadership", "I stopped running one-on-ones from a template. Now each one starts with a single question.", "1200", "85"],
    ["Daniel Brooks", "Hiring", "We rejected a great candidate because our process was slow. Here is how we fixed it.", "300", "140"],
  ];
  for (const [author, topic, body, likes, comments] of entries) {
    await page.getByTestId("add-entry").click();
    await page.getByTestId("entry-author").fill(author);
    await page.getByTestId("entry-topic").fill(topic);
    await page.getByTestId("entry-body").fill(body);
    await page.getByTestId("entry-likes").fill(likes);
    await page.getByTestId("entry-comments").fill(comments);
    await page.getByTestId("save-entry").click();
    await expect(page.getByTestId("library-entry").filter({ hasText: author })).toHaveCount(1);
  }
  await selectOption(page, "library-sort", "Most likes");
  await expect(page.getByTestId("library-entry").first()).toContainText("Priya Natarajan");
  await selectOption(page, "library-sort", "Most comments");
  await expect(page.getByTestId("library-entry").first()).toContainText("Daniel Brooks");
  await page.getByTestId("library-search").fill("one-on-ones");
  await expect(page.getByTestId("library-entry")).toHaveCount(1);
  await page.getByTestId("library-search").fill("");
  await selectOption(page, "library-topic", "Hiring");
  await expect(page.getByTestId("library-entry")).toHaveCount(1);
  await expect(page.getByTestId("library-entry")).toContainText("Daniel Brooks");
  await selectOption(page, "library-topic", "All topics");
  await expect(page.getByTestId("library-entry")).toHaveCount(2);

  await page.goto("/library/collections");
  await page.getByTestId("new-collection-name").fill("Openers");
  await page.getByTestId("create-collection").click();
  await expect(page.getByTestId("collection-name")).toHaveText(["Openers"]);
  await page.goto("/library");
  const priya = page.getByTestId("library-entry").filter({ hasText: "Priya Natarajan" });
  await priya.getByTestId("save-to-collection").click();
  await page.getByRole("menuitem", { name: "Openers" }).click();
  await expect(page.getByText("Saved to Openers")).toBeVisible();
  await page.goto("/library/collections");
  await expect(page.getByTestId("collection-entry")).toContainText(["Priya Natarajan"]);
  await page.getByTestId("rename-collection").click();
  await page.getByTestId("rename-input").fill("Strong openers");
  await page.getByTestId("rename-save").click();
  await expect(page.getByTestId("collection-name")).toHaveText(["Strong openers"]);
  await page.getByTestId("remove-from-collection").click();
  await expect(page.getByTestId("collection-entry")).toHaveCount(0);
  await page.getByTestId("delete-collection").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByTestId("collection-name")).toHaveCount(0);

  await page.goto("/library");
  await Promise.all([
    page.waitForURL(/\/posts\/[0-9a-f-]{36}$/),
    page.getByTestId("library-entry").filter({ hasText: "Daniel Brooks" }).getByTestId("remix-entry").click(),
  ]);
  await expect(page.getByTestId("post-status")).toHaveText("Idea");
  await expect(page.getByTestId("post-body")).toHaveValue(/rejected a great candidate/);
  await page.goto("/library");
  await page.getByTestId("library-entry").filter({ hasText: "Daniel Brooks" }).getByTestId("delete-entry").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByTestId("library-entry")).toHaveCount(1);

  // A board that looks like real use, for the app's picture.
  await newPost(page, "A hiring scorecard you can copy: five signals we look for in every interview.");
  await page.goto("/");
  await expect(page.getByTestId("column-scheduled")).toContainText("Most teams plan too much");
  await expect(page.getByTestId("column-published")).toContainText("public roadmap");
  await expect(page.getByTestId("column-idea")).toContainText("rejected a great candidate");
  await runtime.screenshot(page);

  // Phone-sized smoke.
  const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/");
  await expect(phone.getByRole("heading", { level: 1, name: "Posts" })).toBeVisible();
  await expect(phone.getByTestId("new-post")).toBeVisible();
  await phone.goto("/queue");
  await expect(phone.getByRole("heading", { level: 1, name: "Queue" })).toBeVisible();
} finally {
  await runtime.close();
}
