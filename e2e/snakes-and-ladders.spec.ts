import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Snakes & Ladders: the hold-to-roll dice against the computer, and real online
 * games where every player is a separate browser context (a separate anonymous
 * user) talking to the real server, database and Realtime.
 */

const PLAY = "/games/snakes-and-ladders/play";
const LOBBY = "/games/snakes-and-ladders/online";

interface Player {
  name: string;
  page: Page;
  close: () => Promise<void>;
}

async function newPlayer(browser: Browser, name: string): Promise<Player> {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { name, page, close: () => context.close() };
}

const dice = (page: Page) => page.getByTestId("dice-pad");
const lastRoll = (page: Page) => page.getByTestId("last-roll");

/** Press and keep holding the dice with the mouse. */
async function pressDice(page: Page) {
  const box = await dice(page).boundingBox();
  if (!box) throw new Error("The dice isn't on screen");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(dice(page)).toHaveAttribute("data-holding", "true");
}

/** A quick tap rolls too. */
async function tapDice(page: Page) {
  await dice(page).click();
  await expect(dice(page)).toBeDisabled();
}

/** Every token's square, as seen by this page. */
const tokenSquares = (page: Page) =>
  page
    .locator('[data-testid^="token-"]')
    .evaluateAll((tokens) => tokens.map((t) => `${t.dataset.testid}@${t.dataset.position}`).sort());

/** The one player whose dice is ready to roll. */
async function whoseTurn(players: Player[]): Promise<Player> {
  let ready: Player[] = [];
  await expect(async () => {
    ready = [];
    for (const player of players) if (await dice(player.page).isEnabled()) ready.push(player);
    expect(ready.map((p) => p.name)).toHaveLength(1);
  }).toPass({ timeout: 20_000 });
  return ready[0];
}

test("vs computer: hold to spin, let go to roll, the computers take their turns @mobile", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(PLAY);
  await page.getByText("2 opponents").click();
  await page.getByRole("button", { name: "Start game" }).click();

  await expect(dice(page)).toBeEnabled();
  await expect(dice(page)).toContainText("Your turn: hold to roll");
  await expect(page.getByTestId("token-you")).toHaveAttribute("data-position", "0");
  await expect(page.getByTestId("player-computer-2")).toContainText("Byte");

  // The dice keeps spinning for as long as it's held, and rolls when let go.
  await pressDice(page);
  await expect(dice(page)).toContainText("Let go to roll!");
  await page.waitForTimeout(1_500);
  await expect(dice(page)).toHaveAttribute("data-holding", "true");
  await page.mouse.up();
  await expect(dice(page)).not.toHaveAttribute("data-holding");
  await expect(lastRoll(page)).toContainText(/^You rolled [1-6]/);
  await expect(page.getByTestId("token-you")).not.toHaveAttribute("data-position", "0");

  // A 6 means another go; after that the computers roll, dice visibly spinning.
  await expect(async () => {
    if (await dice(page).isEnabled()) await tapDice(page);
    await expect(dice(page)).toContainText("Robo is rolling…", { timeout: 6_000 });
  }).toPass({ timeout: 40_000 });
  await expect(lastRoll(page)).toContainText(/Robo rolled [1-6]/);

  // Back to you. Hold without letting go: the dice lets go by itself after 5 seconds.
  await expect(dice(page)).toBeEnabled({ timeout: 30_000 });
  await pressDice(page);
  const heldAt = Date.now();
  await expect(dice(page)).not.toHaveAttribute("data-holding", { timeout: 8_000 });
  expect(Date.now() - heldAt).toBeGreaterThan(4_000);
  await page.mouse.up();
  await expect(lastRoll(page)).toContainText(/^You rolled [1-6]/);

  // The board fits a phone screen without sideways scrolling.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "↺ Restart" }).click();
  await expect(page.getByTestId("token-you")).toHaveAttribute("data-position", "0");
});

test("three friends play online: the host starts, turns rotate, rolls show live, and leavers drop out", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const alice = await newPlayer(browser, "Alice");
  const bob = await newPlayer(browser, "Bob");
  const carol = await newPlayer(browser, "Carol");

  await alice.page.goto(LOBBY);
  await alice.page.getByLabel("Your name").fill("Alice");
  await alice.page.getByRole("button", { name: "Create room" }).click();
  await expect(alice.page.getByRole("heading", { name: "Waiting for players…" })).toBeVisible();
  await expect(alice.page.getByRole("button", { name: "Start game (1 player)" })).toBeDisabled();
  const code = (await alice.page.getByTestId("room-code").innerText()).replace(/\s/g, "");

  // Bob joins from the lobby with the code; Carol opens the invite link.
  await bob.page.goto(LOBBY);
  await bob.page.getByLabel("Your name").fill("Bob");
  await bob.page.getByLabel("Room code").fill(code);
  await bob.page.getByRole("button", { name: "Join room" }).click();
  await expect(bob.page.getByRole("heading", { name: "Waiting for the host to start…" })).toBeVisible();
  await expect(bob.page.getByRole("button", { name: /Start game/ })).toHaveCount(0);
  await expect(alice.page.getByRole("heading", { name: "Ready when you are" })).toBeVisible();

  await carol.page.goto(`/games/snakes-and-ladders/room/${code}`);
  await expect(carol.page.getByRole("heading", { name: "Alice invited you to play Snakes & Ladders" })).toBeVisible();
  await carol.page.getByLabel("Your name").fill("Carol");
  await carol.page.getByRole("button", { name: "Join game" }).click();

  await alice.page.getByRole("button", { name: "Start game (3 players)" }).click();
  const players = [alice, bob, carol];
  for (const { page } of players) await expect(dice(page)).toBeVisible();

  // Host goes first; everyone else waits.
  await expect(dice(alice.page)).toBeEnabled();
  await expect(dice(bob.page)).toBeDisabled();
  await expect(dice(bob.page)).toContainText("Waiting for Alice…");
  await expect(dice(carol.page)).toBeDisabled();

  // Everyone sees Alice's dice spin while she holds it, and the same roll when she lets go.
  await pressDice(alice.page);
  await expect(dice(bob.page)).toContainText("Alice is rolling…");
  await expect(dice(carol.page)).toContainText("Alice is rolling…");
  await alice.page.mouse.up();
  await expect(lastRoll(alice.page)).toContainText(/^You rolled [1-6]/);
  const value = (await lastRoll(alice.page).innerText()).match(/rolled (\d)/)![1];
  await expect(lastRoll(bob.page)).toContainText(`Alice rolled ${value}`);
  await expect(lastRoll(carol.page)).toContainText(`Alice rolled ${value}`);

  /** Rolls a few turns, checking that the turn passes in seat order unless someone rolled a 6. */
  async function playTurns(active: Player[], previous: Player, turns: number) {
    for (let i = 0; i < turns; i++) {
      const next = await whoseTurn(active);
      const said = await lastRoll(next.page).innerText();
      const expected = /again!$/.test(said) ? previous : active[(active.indexOf(previous) + 1) % active.length];
      expect(next.name, `after "${said}"`).toBe(expected.name);
      await tapDice(next.page);
      previous = next;
    }
    return previous;
  }

  await playTurns(players, alice, 5);

  // All three boards agree once the moves have played out.
  await whoseTurn(players);
  const squares = await tokenSquares(alice.page);
  expect(squares).toHaveLength(3);
  await expect.poll(() => tokenSquares(bob.page)).toEqual(squares);
  await expect.poll(() => tokenSquares(carol.page)).toEqual(squares);

  // Carol leaves: the game carries on for the other two.
  await carol.page.getByRole("button", { name: "Leave game" }).click();
  await carol.page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(carol.page).toHaveURL(new RegExp(`${LOBBY}$`));
  await expect(alice.page.locator('[data-testid^="player-"]', { hasText: "Carol" })).toContainText("Left the game");
  await expect(bob.page.locator('[data-testid^="player-"]', { hasText: "Carol" })).toContainText("Left the game");

  // (Whoever is up next depends on whether it was Carol's turn; from then on it alternates.)
  const first = await whoseTurn([alice, bob]);
  await tapDice(first.page);
  await playTurns([alice, bob], first, 3);

  // When Bob leaves too, nobody is left to play against.
  await bob.page.getByRole("button", { name: "Leave game" }).click();
  await bob.page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(alice.page.getByRole("heading", { name: "Everyone else left" })).toBeVisible();

  for (const player of players) await player.close();
});

test("rolls for a player who doesn't take their turn within 30 seconds", async ({ browser }) => {
  test.setTimeout(90_000);
  const ann = await newPlayer(browser, "Ann");
  const ben = await newPlayer(browser, "Ben");

  await ann.page.goto(LOBBY);
  await ann.page.getByLabel("Your name").fill("Ann");
  await ann.page.getByRole("button", { name: "Create room" }).click();
  const code = (await ann.page.getByTestId("room-code").innerText()).replace(/\s/g, "");
  await ben.page.goto(LOBBY);
  await ben.page.getByLabel("Your name").fill("Ben");
  await ben.page.getByLabel("Room code").fill(code);
  await ben.page.getByRole("button", { name: "Join room" }).click();
  await ann.page.getByRole("button", { name: "Start game (2 players)" }).click();

  // Ann never rolls. Ben sees the countdown, then the game rolls for her.
  await expect(dice(ann.page)).toBeEnabled();
  await expect(dice(ben.page)).toContainText(/Auto-roll in \d+s/, { timeout: 30_000 });
  await expect(lastRoll(ben.page)).toContainText(/^Out of time, so the game rolled for Ann\. Ann rolled [1-6]/, {
    timeout: 15_000,
  });
  await expect(lastRoll(ann.page)).toContainText(/^Out of time, so the game rolled for you\. You rolled [1-6]/);

  await ann.close();
  await ben.close();
});
