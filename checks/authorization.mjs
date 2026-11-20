// Authorization: private paths, ownership, admin-only deletes, the public preview's limits, no sign-in of its own.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";

const runtime = await startRuntime();
const db = async () => runtime.database();
const one = async (query, ...values) => (await db()).prepare(query).bind(...values).first();
const postIdOf = (page) => new URL(page.url()).pathname.split("/").pop();

async function newPost(page, body) {
  await page.goto("/");
  await Promise.all([page.waitForURL(/\/posts\/[0-9a-f-]{36}$/), page.getByTestId("new-post").click()]);
  await page.getByTestId("post-body").fill(body);
  await page.getByTestId("save-post").click();
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  return postIdOf(page);
}

/** Captures the server-function request `trigger` sends, so it can be replayed with another object's id. */
async function capture(page, marker, trigger) {
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.method() === "POST" && (r.postData() ?? "").includes(marker)),
    trigger(),
  ]);
  return request;
}
async function replay(page, request, from, to) {
  const headers = Object.fromEntries(
    Object.entries(request.headers()).filter(([name]) => name === "content-type" || name === "accept" || name.startsWith("x-")),
  );
  const body = request.postData().replaceAll(from, to);
  // From inside the page, so the replay carries the same member's identity.
  return page.evaluate(async ({ url, headers, body }) => (await fetch(url, { method: "POST", headers, body })).status, { url: request.url(), headers, body });
}

async function addEntry(page, author, body) {
  await page.goto("/library");
  await page.getByTestId("add-entry").click();
  await page.getByTestId("entry-author").fill(author);
  await page.getByTestId("entry-topic").fill("Careers");
  await page.getByTestId("entry-body").fill(body);
  await page.getByTestId("save-entry").click();
  await expect(page.getByTestId("library-entry").filter({ hasText: author })).toHaveCount(1);
  return (await one("SELECT id FROM library_entries WHERE author_name = ?", author)).id;
}

try {
  const privatePaths = ["/", "/queue", "/calendar", "/library", "/library/collections", "/stats", "/settings"];
  await runtime.assertPrivateAccess(privatePaths);

  // No sign-in of its own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/logout"]) {
    const anonymous = await runtime.fetch(path);
    expect(anonymous.status).not.toBe(200);
    const member = await runtime.fetch(path, { role: "member" });
    expect(member.status).toBe(404);
  }
  expect(await (await runtime.fetch("/", { role: "member" })).text()).not.toMatch(/type="password"/i);

  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();

  // Posts are private to their author.
  const ownerPost = await newPost(owner, "Owner draft: quarterly results announcement, not ready to share.");
  for (const role of [undefined, "outsider"]) {
    expect((await runtime.fetch(`/posts/${ownerPost}`, { role })).status).not.toBe(200);
  }
  await member.goto(`/posts/${ownerPost}`);
  await expect(member.getByTestId("post-not-found")).toBeVisible();
  await expect(member.getByText("quarterly results")).toHaveCount(0);
  await member.goto("/");
  await expect(member.getByText("quarterly results")).toHaveCount(0);
  await member.goto("/calendar");
  await expect(member.getByText("quarterly results")).toHaveCount(0);

  // A member's own request, replayed against the owner's post, changes nothing.
  const memberPost = await newPost(member, "Member draft about onboarding.");
  await member.getByTestId("post-body").fill("Member draft about onboarding, edited.");
  const save = await capture(member, memberPost, () => member.getByTestId("save-post").click());
  await expect(member.getByTestId("save-state")).toHaveText("Saved");
  await replay(member, save, memberPost, ownerPost);
  expect((await one("SELECT body FROM posts WHERE id = ?", ownerPost)).body).toContain("quarterly results");

  const share = await capture(member, memberPost, () => member.getByTestId("create-share-link").click());
  await expect(member.getByTestId("share-link")).toBeVisible();
  await replay(member, share, memberPost, ownerPost);
  expect(await one("SELECT token FROM share_links WHERE post_id = ?", ownerPost)).toBeNull();

  const queue = await capture(member, memberPost, () => member.getByTestId("add-to-queue").click());
  await replay(member, queue, memberPost, ownerPost);
  expect((await one("SELECT status FROM posts WHERE id = ?", ownerPost)).status).toBe("draft");

  const duplicate = await capture(member, memberPost, () => member.getByTestId("duplicate-post").click());
  await member.waitForURL((url) => !url.pathname.endsWith(memberPost));
  await replay(member, duplicate, memberPost, ownerPost);
  expect((await one("SELECT count(*) AS n FROM posts WHERE body LIKE '%quarterly results%'")).n).toBe(1);

  await member.goto(`/posts/${memberPost}`);
  await member.getByTestId("delete-post").click();
  const remove = await capture(member, memberPost, () => member.getByRole("button", { name: "Delete", exact: true }).click());
  await member.waitForURL((url) => url.pathname === "/");
  await replay(member, remove, memberPost, ownerPost);
  expect(await one("SELECT id FROM posts WHERE id = ?", ownerPost)).not.toBeNull();

  // Stats cover only the member's own posts.
  await (await db()).prepare("UPDATE posts SET status = 'published', published_at = ?, impressions = 5000 WHERE id = ?").bind(Date.now() - 86400000, ownerPost).run();
  await member.goto("/stats");
  await expect(member.getByTestId("stat-impressions")).toHaveText("0");
  await expect(member.getByTestId("stats-row")).toHaveCount(0);

  // The public preview shows only the shared post, and nothing once revoked.
  const shownPost = await newPost(owner, "A preview for feedback before Monday.");
  await owner.getByTestId("create-share-link").click();
  const sharePath = new URL(await owner.getByTestId("share-link").inputValue()).pathname;
  const preview = await runtime.fetch(sharePath);
  expect(preview.status).toBe(200);
  const html = await preview.text();
  expect(html).toContain("A preview for feedback before Monday.");
  expect(html).not.toContain("quarterly results");
  expect(html).not.toMatch(/@[a-z0-9.-]+\.(test|example|com)/i);
  expect((await runtime.fetch("/s/not-a-real-token-at-all")).status).toBe(404);
  await owner.getByTestId("revoke-share-link").click();
  await expect(owner.getByTestId("create-share-link")).toBeVisible();
  expect((await runtime.fetch(sharePath)).status).toBe(404);
  const visitor = await (await runtime.context(null)).newPage();
  await visitor.goto(sharePath);
  await expect(visitor.getByTestId("shared-not-found")).toBeVisible();
  await expect(visitor.getByText("A preview for feedback")).toHaveCount(0);
  expect(shownPost).toBeTruthy();

  // Library: only the adder or an admin deletes an entry.
  const ownerEntry = await addEntry(owner, "Owner Example", "An owner's example post about careers.");
  await member.goto("/library");
  const ownerRow = member.getByTestId("library-entry").filter({ hasText: "Owner Example" });
  await expect(ownerRow).toHaveCount(1);
  await expect(ownerRow.getByTestId("delete-entry")).toHaveCount(0);
  const memberEntry = await addEntry(member, "Member Example", "A member's example post about careers.");
  await member.getByTestId("library-entry").filter({ hasText: "Member Example" }).getByTestId("delete-entry").click();
  const removeEntry = await capture(member, memberEntry, () => member.getByRole("button", { name: "Delete", exact: true }).click());
  await expect(member.getByTestId("library-entry").filter({ hasText: "Member Example" })).toHaveCount(0);
  await replay(member, removeEntry, memberEntry, ownerEntry);
  expect(await one("SELECT id FROM library_entries WHERE id = ?", ownerEntry)).not.toBeNull();
  await addEntry(member, "Second Member Example", "Another member example.");
  await owner.goto("/library");
  await owner.getByTestId("library-entry").filter({ hasText: "Second Member Example" }).getByTestId("delete-entry").click();
  await owner.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(owner.getByTestId("library-entry").filter({ hasText: "Second Member Example" })).toHaveCount(0);

  // Collections are private.
  await owner.goto("/library/collections");
  await owner.getByTestId("new-collection-name").fill("Owner picks");
  await owner.getByTestId("create-collection").click();
  await expect(owner.getByTestId("collection-name")).toHaveText(["Owner picks"]);
  const ownerCollection = (await one("SELECT id FROM collections WHERE name = 'Owner picks'")).id;
  await member.goto("/library/collections");
  await expect(member.getByText("Owner picks")).toHaveCount(0);
  await member.getByTestId("new-collection-name").fill("Member picks");
  await member.getByTestId("create-collection").click();
  await expect(member.getByTestId("collection-name")).toHaveText(["Member picks"]);
  const memberCollection = (await one("SELECT id FROM collections WHERE name = 'Member picks'")).id;
  await member.getByTestId("rename-collection").click();
  await member.getByTestId("rename-input").fill("Member favourites");
  const rename = await capture(member, memberCollection, () => member.getByTestId("rename-save").click());
  await replay(member, rename, memberCollection, ownerCollection);
  expect((await one("SELECT name FROM collections WHERE id = ?", ownerCollection)).name).toBe("Owner picks");
  await member.goto("/library");
  await member.getByTestId("library-entry").filter({ hasText: "Owner Example" }).getByTestId("save-to-collection").click();
  const add = await capture(member, memberCollection, () => member.getByRole("menuitem", { name: "Member favourites" }).click());
  await replay(member, add, memberCollection, ownerCollection);
  expect((await one("SELECT count(*) AS n FROM collection_items WHERE collection_id = ?", ownerCollection)).n).toBe(0);
} finally {
  await runtime.close();
}
