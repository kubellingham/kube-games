import { expect, test } from "@playwright/test";

test("plays rounds against the computer, tracks the score and resets it @mobile", async ({ page }) => {
  await page.goto("/games/rock-paper-scissors/play");
  await expect(page.getByText("Round 1 — choose your move")).toBeVisible();

  await page.getByRole("button", { name: "Rock" }).click();
  const reveal = page.getByTestId("round-reveal");
  await expect(reveal).toBeVisible();
  await expect(reveal).toHaveAttribute("data-outcome", /^(win|lose|draw)$/);
  await expect(page.getByText(/1 round · \d+% won/)).toBeVisible();

  await page.getByRole("button", { name: "Play again" }).click();
  await expect(page.getByText("Round 2 — choose your move")).toBeVisible();

  // Keyboard shortcut: P plays paper.
  await page.keyboard.press("p");
  await expect(page.getByTestId("round-reveal")).toBeVisible();
  await expect(page.getByText(/2 rounds · \d+% won/)).toBeVisible();

  // Score survives a refresh.
  await page.reload();
  await expect(page.getByText(/2 rounds · \d+% won/)).toBeVisible();

  await page.getByRole("button", { name: "↺ Reset score" }).click();
  await expect(page.getByText("Round 1 — choose your move")).toBeVisible();
  await expect(page.getByText(/rounds? · \d+% won/)).toHaveCount(0);
});
