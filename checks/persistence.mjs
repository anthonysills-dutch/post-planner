// Persistence: what members write survives a restart. Also the AI actions with no model configured.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";

const runtime = await startRuntime();
try {
  let page = await (await runtime.context("owner")).newPage();
  await page.goto("/settings");
  await page.getByTestId("display-name").fill("Sam Lee");
  await page.getByTestId("weekly-goal").fill("4");
  await page.getByTestId("save-settings").click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await page.getByTestId("slot-time").fill("08:30");
  await page.getByTestId("add-slot").click();
  await expect(page.getByTestId("slot-row")).toHaveCount(1);

  await page.goto("/");
  await Promise.all([page.waitForURL(/\/posts\/[0-9a-f-]{36}$/), page.getByTestId("new-post").click()]);
  const postPath = new URL(page.url()).pathname;

  // F002 with no model configured: the actions are off with a notice, the editor still works.
  await expect(page.getByTestId("ai-off")).toBeVisible();
  await expect(page.getByTestId("ai-draft")).toBeDisabled();
  await expect(page.getByTestId("ai-shorten")).toBeDisabled();

  await page.getByTestId("post-body").fill("Notes from our first customer advisory board.");
  await page.getByTestId("status-ready").click();
  await page.getByTestId("save-post").click();
  await expect(page.getByTestId("save-state")).toHaveText("Saved");
  await page.getByTestId("add-to-queue").click();
  await expect(page.getByTestId("post-status")).toHaveText("Scheduled");
  await page.getByTestId("create-share-link").click();
  const sharePath = new URL(await page.getByTestId("share-link").inputValue()).pathname;

  await page.goto("/library");
  await page.getByTestId("add-entry").click();
  await page.getByTestId("entry-author").fill("Lena Fischer");
  await page.getByTestId("entry-topic").fill("Product");
  await page.getByTestId("entry-body").fill("The feature nobody asked for became our most used one.");
  await page.getByTestId("save-entry").click();
  await expect(page.getByTestId("library-entry")).toHaveCount(1);
  await page.goto("/library/collections");
  await page.getByTestId("new-collection-name").fill("Product stories");
  await page.getByTestId("create-collection").click();
  await expect(page.getByTestId("collection-name")).toHaveText(["Product stories"]);

  await runtime.restart();

  page = await (await runtime.context("owner")).newPage();
  await page.goto(postPath);
  await expect(page.getByTestId("post-body")).toHaveValue("Notes from our first customer advisory board.");
  await expect(page.getByTestId("post-status")).toHaveText("Scheduled");
  await expect(page.getByTestId("scheduled-for")).toContainText("08:30");
  await page.goto("/settings");
  await expect(page.getByTestId("display-name")).toHaveValue("Sam Lee");
  await expect(page.getByTestId("weekly-goal")).toHaveValue("4");
  await expect(page.getByTestId("slot-row")).toHaveCount(1);
  await page.goto("/library");
  await expect(page.getByTestId("library-entry")).toContainText(["Lena Fischer"]);
  await page.goto("/library/collections");
  await expect(page.getByTestId("collection-name")).toHaveText(["Product stories"]);
  const preview = await runtime.fetch(sharePath);
  expect(preview.status).toBe(200);
  expect(await preview.text()).toContain("customer advisory board");
} finally {
  await runtime.close();
}
