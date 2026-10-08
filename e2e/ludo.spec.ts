import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Ludo against the computer (with the dice scripted, so a whole sequence of moves
 * including a capture plays out the same way every time) and online between
 * separate browser contexts.
 */

const PLAY = "/games/ludo/play";
const LOBBY = "/games/ludo/online";

const dice = (page: Page) => page.getByTestId("dice-pad");
const lastRoll = (page: Page) => page.getByTestId("last-roll");
const token = (page: Page, playerId: string, index: number) => page.getByTestId(`token-${playerId}-${index}`);

/**
 * Makes the browser's dice roll these values, in order. The computer mode draws
 * each roll from crypto.getRandomValues; nothing else in it asks for one number.
 */
async function scriptDice(page: Page, values: number[]) {
  await page.addInitScript((queue: number[]) => {
    const real = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = ((array: Uint32Array) => {
      if (queue.length && array instanceof Uint32Array && array.length === 1) {
        array[0] = Math.floor(((queue.shift()! - 1) / 6 + 1 / 12) * 2 ** 32);
        return array;
      }
      return real(array);
    }) as typeof crypto.getRandomValues;
  }, values);
}

async function roll(page: Page) {
  await expect(dice(page)).toBeEnabled({ timeout: 20_000 });
  await page.keyboard.down("Space");
  await expect(dice(page)).toHaveAttribute("data-holding", "true");
  await page.keyboard.up("Space");
}

test("vs computer: bring tokens out, pick moves and capture @mobile", async ({ page }) => {
  test.setTimeout(90_000);
  // You: 6, 3. Robo: 6, 2. Byte: 1. Pixel: 1. You: 6, 6 (capturing Robo), 1.
  await scriptDice(page, [6, 3, 6, 2, 1, 1, 6, 6, 1]);
  await page.goto(PLAY);
  await page.getByText("3 opponents").click();
  await page.getByRole("button", { name: "Start game" }).click();

  // Holding with the mouse spins the dice until it's let go.
  const box = (await dice(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(dice(page)).toHaveAttribute("data-holding", "true");
  await page.waitForTimeout(400);
  await page.mouse.up();
  // A 6 brings a token out; every token in the yard is the same, so no need to ask.
  await expect(lastRoll(page)).toHaveText("You rolled 6 and brought a token out. Roll again!");
  await expect(token(page, "you", 0)).toHaveAttribute("data-step", "0");

  // Only the token on the board can use a 3, so it moves by itself.
  await roll(page);
  await expect(lastRoll(page)).toHaveText("You rolled 3 and moved a token.");
  await expect(token(page, "you", 0)).toHaveAttribute("data-step", "3");

  // The computers play: Robo comes out and moves 2; Byte and Pixel can't move.
  await expect(token(page, "computer-1", 0)).toHaveAttribute("data-step", "2", { timeout: 20_000 });
  await expect(lastRoll(page)).toHaveText("Pixel rolled 1 but no token can move.", { timeout: 20_000 });

  // A 6 with a token out is a choice: every token that can move glows.
  await roll(page);
  await expect(lastRoll(page)).toHaveText("You rolled 6. Pick a token to move.");
  await expect(page.locator("[data-movable]")).toHaveCount(4);
  await token(page, "you", 0).click();
  await expect(token(page, "you", 0)).toHaveAttribute("data-step", "9");
  await expect(page.locator("[data-movable]")).toHaveCount(0);

  // Landing on Robo's token sends it back to its yard.
  await roll(page);
  await token(page, "you", 0).click();
  await expect(lastRoll(page)).toHaveText("You rolled 6 and captured Robo's token! Roll again!");
  await expect(token(page, "you", 0)).toHaveAttribute("data-step", "15");
  await expect(token(page, "computer-1", 0)).toHaveAttribute("data-step", "-1");

  await roll(page);
  await expect(lastRoll(page)).toHaveText("You rolled 1 and moved a token.");
  await expect(page.getByTestId("player-you")).toContainText("0/4 home");

  // The board fits a phone screen without sideways scrolling.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

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

/** Every token's step, as seen by this page. */
const tokenSteps = (page: Page) =>
  page
    .locator('[data-testid^="token-"]')
    .evaluateAll((tokens) => tokens.map((t) => `${t.dataset.testid}@${t.dataset.step}`).sort());

test("two friends play Ludo online, with live rolls and the same board for both", async ({ browser }) => {
  test.setTimeout(120_000);
  const alice = await newPlayer(browser, "Alice");
  const bob = await newPlayer(browser, "Bob");

  await alice.page.goto(LOBBY);
  await alice.page.getByLabel("Your name").fill("Alice");
  await alice.page.getByRole("button", { name: "Create room" }).click();
  const code = (await alice.page.getByTestId("room-code").innerText()).replace(/\s/g, "");
  await bob.page.goto(LOBBY);
  await bob.page.getByLabel("Your name").fill("Bob");
  await bob.page.getByLabel("Room code").fill(code);
  await bob.page.getByRole("button", { name: "Join room" }).click();
  await alice.page.getByRole("button", { name: "Start game (2 players)" }).click();

  // Each player sees their own yard bottom left.
  await expect(dice(alice.page)).toBeEnabled();
  await expect(dice(bob.page)).toContainText("Waiting for Alice…");

  // Bob watches Alice's dice spin, then both see the same roll.
  const box = (await dice(alice.page).boundingBox())!;
  await alice.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await alice.page.mouse.down();
  await expect(dice(bob.page)).toContainText("Alice is rolling…");
  await alice.page.mouse.up();
  await expect(lastRoll(alice.page)).toContainText(/^You rolled [1-6]/);
  const value = (await lastRoll(alice.page).innerText()).match(/rolled (\d)/)![1];
  await expect(lastRoll(bob.page)).toContainText(`Alice rolled ${value}`);

  // Play a few more turns, picking a token whenever there's a choice.
  for (let i = 0; i < 8; i++) {
    let mover: Player | undefined;
    await expect(async () => {
      mover = undefined;
      for (const player of [alice, bob]) {
        if ((await dice(player.page).isEnabled()) || (await player.page.locator("[data-movable]").count())) mover = player;
      }
      expect(mover).toBeDefined();
    }).toPass({ timeout: 20_000 });
    const movable = mover!.page.locator("[data-movable]");
    if (await movable.count()) await movable.first().click();
    else await dice(mover!.page).click();
    await mover!.page.waitForTimeout(300);
  }

  // Both boards agree once the moves have played out.
  await expect.poll(async () => JSON.stringify(await tokenSteps(bob.page)), { timeout: 15_000 }).toBe(
    JSON.stringify(await tokenSteps(alice.page)),
  );
  expect(await tokenSteps(alice.page)).toHaveLength(8);

  // When Bob leaves, Alice has nobody left to play.
  await bob.page.getByRole("button", { name: "Leave game" }).click();
  await bob.page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(alice.page.getByRole("heading", { name: "Everyone else left" })).toBeVisible();

  await alice.close();
  await bob.close();
});
