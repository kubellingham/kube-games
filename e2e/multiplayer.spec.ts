import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Real multiplayer tests: every player is a separate browser context (separate
 * storage, so a separate anonymous Supabase user) talking to the real server,
 * database and Realtime. Nothing is simulated.
 */

const LOBBY = "/games/rock-paper-scissors/online";

async function newPlayer(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

async function createRoom(page: Page, name: string) {
  await page.goto(LOBBY);
  await page.getByLabel("Your name").fill(name);
  await page.getByText("First to 3").click();
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for another player…" })).toBeVisible();
  const code = (await page.getByTestId("room-code").innerText()).replace(/\s/g, "");
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  return code;
}

async function joinFromLobby(page: Page, name: string, code: string) {
  await page.goto(LOBBY);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Room code").fill(code);
  await page.getByRole("button", { name: "Join room" }).click();
}

/** Everything the page receives from the rooms API and over Realtime websockets. */
function recordIncomingTraffic(page: Page): string[] {
  const received: string[] = [];
  page.on("response", async (response) => {
    if (response.url().includes("/api/rooms")) received.push(await response.text().catch(() => ""));
  });
  page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => received.push(String(payload))));
  return received;
}

async function nextRound(page: Page) {
  await expect(page.getByTestId("round-reveal")).toBeVisible();
  await page.getByRole("button", { name: "Next round" }).click();
}

const move = (page: Page, name: "Rock" | "Paper" | "Scissors") =>
  page.getByRole("button", { name, exact: true }).click();

test("two players play a full match in real time, with hidden moves, refresh, rematch and leaving", async ({
  browser,
}) => {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);

  const code = await createRoom(alice.page, "Alice");
  const bobReceived = recordIncomingTraffic(bob.page);
  await joinFromLobby(bob.page, "Bob", code);
  await expect(bob.page).toHaveURL(new RegExp(`/room/${code}$`));

  // The host learns in real time that someone joined.
  await expect(alice.page.getByText("Opponent joined!")).toBeVisible();
  await expect(alice.page.getByText("Bob is here.")).toBeVisible();
  await expect(bob.page.getByText("Your turn")).toBeVisible();

  // Alice locks in first. Bob only learns *that* she locked in, never *what*.
  await move(alice.page, "Rock");
  await expect(alice.page.getByText("You chose Rock.")).toBeVisible();
  await expect(alice.page.getByText("Choice locked in. Waiting for Bob…")).toBeVisible();
  await expect(bob.page.getByText("Alice has locked in. Choose your move!")).toBeVisible();
  expect(bobReceived.length).toBeGreaterThan(0);
  expect(bobReceived.join("\n")).not.toContain('"rock"');

  // Bob plays; both browsers reveal the same round at once.
  await move(bob.page, "Scissors");
  await expect(alice.page.getByTestId("round-reveal")).toHaveAttribute("data-outcome", "win");
  await expect(bob.page.getByTestId("round-reveal")).toHaveAttribute("data-outcome", "lose");
  await expect(alice.page.getByLabel("Alice: 1")).toBeVisible();
  await expect(bob.page.getByLabel("Alice: 1")).toBeVisible();
  await expect(bob.page.getByLabel("Bob: 0")).toBeVisible();

  // A refresh mid-match keeps Bob in his seat with the same score.
  await nextRound(alice.page);
  await bob.page.reload();
  await expect(bob.page.getByText("Your turn")).toBeVisible();
  await expect(bob.page.getByLabel("Alice: 1")).toBeVisible();

  // Rounds 2 and 3: Paper beats Rock, so Alice reaches 3 and wins the match.
  await move(alice.page, "Paper");
  await move(bob.page, "Rock");
  await nextRound(alice.page);
  await nextRound(bob.page);
  await move(bob.page, "Rock");
  await move(alice.page, "Paper");

  await expect(alice.page.getByText("🏆 You won the match!")).toBeVisible();
  await expect(bob.page.getByText("Alice won the match")).toBeVisible();
  await expect(bob.page.getByText("Final score 0 – 3")).toBeVisible();

  // A rematch starts only when both players agree.
  await bob.page.getByRole("button", { name: "Rematch" }).click();
  await expect(bob.page.getByRole("button", { name: "Waiting for opponent…" })).toBeVisible();
  await expect(alice.page.getByText("Bob wants a rematch!")).toBeVisible();
  await alice.page.getByRole("button", { name: "Accept rematch" }).click();
  await expect(alice.page.getByText("Your turn")).toBeVisible();
  await expect(alice.page.getByLabel("Alice: 0")).toBeVisible();
  await expect(bob.page.getByText("Your turn")).toBeVisible();

  // Bob leaves; Alice is told and the match ends.
  await bob.page.getByRole("button", { name: "Leave game" }).click();
  await bob.page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(bob.page).toHaveURL(new RegExp(`${LOBBY}$`));
  await expect(alice.page.getByRole("heading", { name: "Bob left the game" })).toBeVisible();

  await alice.page.getByRole("button", { name: "Back to lobby" }).first().click();
  await expect(alice.page).toHaveURL(new RegExp(`${LOBBY}$`));

  await alice.context.close();
  await bob.context.close();
});

test("a friend joins from an invite link, and a third player is turned away @mobile", async ({ browser }) => {
  const host = await newPlayer(browser);
  const friend = await newPlayer(browser);
  const stranger = await newPlayer(browser);

  const code = await createRoom(host.page, "Host");
  const inviteUrl = `/games/rock-paper-scissors/room/${code}`;

  await friend.page.goto(inviteUrl);
  await expect(friend.page.getByRole("heading", { name: "Host invited you to play Rock Paper Scissors" })).toBeVisible();
  await friend.page.getByLabel("Your name").fill("Friend");
  await friend.page.getByRole("button", { name: "Join game" }).click();
  await expect(friend.page.getByText("Your turn")).toBeVisible();
  await expect(host.page.getByText("Your turn")).toBeVisible();

  await stranger.page.goto(inviteUrl);
  await expect(stranger.page.getByRole("heading", { name: "Room is full" })).toBeVisible();

  await joinFromLobby(stranger.page, "Stranger", code);
  await expect(stranger.page.getByText("This room is already full.")).toBeVisible();

  for (const player of [host, friend, stranger]) await player.context.close();
});

test("invalid, unknown and cancelled rooms show helpful errors", async ({ browser }) => {
  const host = await newPlayer(browser);
  const guest = await newPlayer(browser);
  const { page } = guest;

  await joinFromLobby(page, "Guest", "ABC");
  await expect(page.getByText("Room codes are 6 letters and numbers, like K7F3QX.")).toBeVisible();

  await joinFromLobby(page, "Guest", "ZZZZZZ");
  await expect(page.getByText("We couldn't find a room with that code. Check it and try again.")).toBeVisible();

  await page.goto("/games/rock-paper-scissors/room/ZZZZZZ");
  await expect(page.getByRole("heading", { name: "Room not found" })).toBeVisible();

  // The host cancels before anyone joins: the room is gone.
  const code = await createRoom(host.page, "Host");
  await host.page.getByRole("button", { name: "Cancel room" }).click();
  await host.page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(host.page).toHaveURL(new RegExp(`${LOBBY}$`));
  await joinFromLobby(page, "Guest", code);
  await expect(page.getByText("We couldn't find a room with that code. Check it and try again.")).toBeVisible();

  await host.context.close();
  await guest.context.close();
});

test("a player who drops offline catches up when the connection returns", async ({ browser }) => {
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);
  const code = await createRoom(alice.page, "Alice");
  await joinFromLobby(bob.page, "Bob", code);
  await expect(bob.page.getByText("Your turn")).toBeVisible();

  await bob.context.setOffline(true);
  await move(alice.page, "Paper");
  await expect(alice.page.getByText("Choice locked in. Waiting for Bob…")).toBeVisible();
  await bob.context.setOffline(false);

  await expect(bob.page.getByText("Alice has locked in. Choose your move!")).toBeVisible({ timeout: 20_000 });
  await move(bob.page, "Scissors");
  await expect(bob.page.getByTestId("round-reveal")).toHaveAttribute("data-outcome", "win");
  await expect(alice.page.getByTestId("round-reveal")).toHaveAttribute("data-outcome", "lose");

  await alice.context.close();
  await bob.context.close();
});

test("quick match pairs two players into the same room", async ({ browser }) => {
  const first = await newPlayer(browser);
  const second = await newPlayer(browser);

  for (const [player, name] of [
    [first, "Quick One"],
    [second, "Quick Two"],
  ] as const) {
    await player.page.goto(LOBBY);
    await player.page.getByLabel("Your name").fill(name);
    await player.page.getByRole("button", { name: "Find a match" }).click();
    await expect(player.page).toHaveURL(/\/room\/[A-HJKMNP-Z2-9]{6}$/);
  }

  expect(second.page.url()).toBe(first.page.url());
  await expect(first.page.getByText("Your turn")).toBeVisible();
  await expect(second.page.getByText("Your turn")).toBeVisible();

  await first.context.close();
  await second.context.close();
});

test("stays in sync even when Realtime silently drops change events", async ({ browser }) => {
  test.setTimeout(90_000);
  const alice = await newPlayer(browser);
  const bob = await newPlayer(browser);

  // Keep Alice's Realtime socket connected but swallow every database change event,
  // as can happen while Realtime restarts replication.
  let dropped = 0;
  await alice.page.routeWebSocket(/\/realtime\/v1\/websocket/, (socket) => {
    const server = socket.connectToServer();
    server.onMessage((message) => {
      if (typeof message === "string" && /"postgres_changes",\s*\{|"event":\s*"postgres_changes"/.test(message)) {
        dropped++;
        return;
      }
      socket.send(message);
    });
  });

  const code = await createRoom(alice.page, "Alice");
  await joinFromLobby(bob.page, "Bob", code);
  await expect(alice.page.getByText("Your turn")).toBeVisible({ timeout: 25_000 });

  await move(bob.page, "Rock");
  await expect(alice.page.getByText("Bob has locked in. Choose your move!")).toBeVisible({ timeout: 25_000 });
  expect(dropped).toBeGreaterThan(0);

  await alice.context.close();
  await bob.context.close();
});
