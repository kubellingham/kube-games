import { expect, test } from "@playwright/test";

test("the home page redirects to the game library @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/games$/);
  await expect(page.getByRole("heading", { name: /Pick a game/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All games" })).toBeVisible();
});

test("library cards come from the registry and can be searched and filtered", async ({ page }) => {
  await page.goto("/games");
  const library = page.getByRole("region", { name: "All games" });

  await expect(library.getByRole("link", { name: "Play Rock Paper Scissors" })).toBeVisible();
  await expect(library.getByText("Coming soon").first()).toBeVisible();

  await library.getByPlaceholder("Search games").fill("zzz");
  await expect(library.getByText("No games match")).toBeVisible();
  await library.getByRole("button", { name: "Clear filters" }).click();
  await expect(library.getByRole("heading", { name: "Rock Paper Scissors" })).toBeVisible();

  await library.getByRole("button", { name: "🌐 Online" }).click();
  await expect(library.getByRole("heading", { name: "Rock Paper Scissors" })).toBeVisible();
});

test("a game page offers each supported mode", async ({ page }) => {
  await page.goto("/games");
  await page.getByRole("link", { name: "Play Rock Paper Scissors" }).first().click();
  await expect(page).toHaveURL(/\/games\/rock-paper-scissors$/);
  await expect(page.getByRole("link", { name: /Play vs Computer/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Play Online/ })).toBeVisible();

  await page.getByRole("link", { name: "← Library" }).click();
  await expect(page).toHaveURL(/\/games$/);
});

test("unknown games show a not-found page", async ({ page }) => {
  await page.goto("/games/not-a-real-game");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  // The prerendered shell streams first, so Next.js keeps a 200 status and marks the page noindex instead.
  await expect(page.locator('meta[name="robots"][content="noindex"]').first()).toBeAttached();
});

test("every screen fits the viewport without sideways scrolling @mobile", async ({ page }) => {
  const expectNoHorizontalScroll = async () => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${page.url()}`).toBeLessThanOrEqual(0);
  };

  for (const path of [
    "/games",
    "/games/rock-paper-scissors",
    "/games/rock-paper-scissors/play",
    "/games/rock-paper-scissors/online",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expectNoHorizontalScroll();
  }

  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for another player…" })).toBeVisible();
  await expectNoHorizontalScroll();
  await page.getByRole("button", { name: "Cancel room" }).click();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
});
