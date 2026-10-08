import { expect, test, type Browser, type Page } from "@playwright/test";

/** Connect Four against the computer, and online between two separate browser contexts. */

const PLAY = "/games/connect-four/play";
const LOBBY = "/games/connect-four/online";

const status = (page: Page) => page.getByTestId("c4-status");
const column = (page: Page, n: number) => page.getByRole("button", { name: `Drop in column ${n}`, exact: true });
const discs = (page: Page, color: "red" | "yellow") => page.locator(`[data-testid^="c4-cell-"][data-disc="${color}"]`);

test("vs computer: drop discs by tap or keyboard, and the computer answers @mobile", async ({ page }) => {
  await page.goto(PLAY);
  await expect(status(page)).toHaveText("Your turn");
  await expect(page.getByText("You go first.")).toBeVisible();

  await column(page, 4).click();
  await expect(page.getByTestId("c4-cell-5-3")).toHaveAttribute("data-disc", "red");
  await expect(discs(page, "yellow")).toHaveCount(1, { timeout: 10_000 });
  await expect(status(page)).toHaveText("Your turn");

  // Keys 1–7 drop straight into a column.
  await page.keyboard.press("1");
  await expect(page.locator('[data-testid$="-0"][data-disc="red"]')).toHaveCount(1);
  await expect(discs(page, "red")).toHaveCount(2);
  await expect(discs(page, "yellow")).toHaveCount(2, { timeout: 10_000 });

  // The difficulty choice is remembered.
  await page.getByText("Hard", { exact: true }).click();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Hard" })).toBeChecked();

  // The board fits a phone screen without sideways scrolling.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

async function newPlayer(browser: Browser) {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

test("two players play online: live aim, a win, a rematch and leaving", async ({ browser }) => {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);

  await alice.page.goto(LOBBY);
  await alice.page.getByLabel("Your name").fill("Alice");
  await alice.page.getByRole("button", { name: "Create room" }).click();
  const code = (await alice.page.getByTestId("room-code").innerText()).replace(/\s/g, "");
  await bob.page.goto(LOBBY);
  await bob.page.getByLabel("Your name").fill("Bob");
  await bob.page.getByLabel("Room code").fill(code);
  await bob.page.getByRole("button", { name: "Join room" }).click();

  // The server picks who starts.
  await expect(status(alice.page)).toHaveText(/^(Your turn|Waiting for Bob…)$/);
  const aliceFirst = (await status(alice.page).innerText()) === "Your turn";
  const [first, second] = aliceFirst ? [alice, bob] : [bob, alice];
  const [firstName, secondName] = aliceFirst ? ["Alice", "Bob"] : ["Bob", "Alice"];
  await expect(status(second.page)).toHaveText(`Waiting for ${firstName}…`);
  await expect(column(second.page, 1)).toBeDisabled();

  // Where the first player aims shows faintly on the other screen.
  await column(first.page, 5).hover();
  await expect(second.page.getByTestId("c4-aim")).toHaveAttribute("data-column", "4");
  await expect(second.page.getByTestId("c4-aim")).toHaveAttribute("data-faint", "true");

  // First player stacks column 1; the second stacks column 2. Four in a column wins.
  for (let i = 0; i < 3; i++) {
    await column(first.page, 1).click();
    await expect(status(second.page)).toHaveText("Your turn");
    await column(second.page, 2).click();
    await expect(status(first.page)).toHaveText("Your turn");
  }
  await column(first.page, 1).click();

  await expect(status(first.page)).toHaveText("You win!");
  await expect(status(second.page)).toHaveText(`${firstName} wins`);
  await expect(second.page.locator("[data-winning]")).toHaveCount(4);
  for (let row = 2; row < 6; row++) {
    await expect(second.page.getByTestId(`c4-cell-${row}-0`)).toHaveAttribute("data-winning", "");
  }

  // A rematch needs both players; it starts on an empty board.
  await second.page.getByRole("button", { name: "Rematch" }).click();
  await expect(second.page.getByRole("button", { name: "Waiting for opponent…" })).toBeVisible();
  await expect(first.page.getByText(`${secondName} wants a rematch!`)).toBeVisible();
  await first.page.getByRole("button", { name: "Accept rematch" }).click();
  await expect(discs(first.page, "red")).toHaveCount(0);
  await expect(status(first.page)).toHaveText(/^(Your turn|Waiting for .+…)$/);
  await expect(status(second.page)).toHaveText(/^(Your turn|Waiting for .+…)$/);

  // Leaving ends the game for the other player.
  await second.page.getByRole("button", { name: "Leave game" }).click();
  await second.page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(first.page.getByRole("heading", { name: `${secondName} left the game` })).toBeVisible();

  await alice.context.close();
  await bob.context.close();
});
