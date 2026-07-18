import { expect, test, type Page } from "@playwright/test";

interface BrowserSnapshot {
  readonly state: string;
  readonly currentWave: number;
  readonly score: number;
  readonly lives: number;
  readonly playerAngle: number;
  readonly playerShots: number;
  readonly dashCooldown: number;
  readonly enemies: number;
  readonly pendingSpawns: number;
  readonly run: {
    readonly accuracyPercent: number;
    readonly elapsedSeconds: number;
    readonly shotsFired: number;
    readonly damageTaken: number;
    readonly lastDamageSource: string | null;
    readonly firstMoveSeconds: number | null;
    readonly firstShotSeconds: number | null;
    readonly firstDashSeconds: number | null;
  };
}

test.describe("Orbit Breaker browser smoke", () => {
  test("loads a non-blank title canvas without browser errors", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/?seed=browser-smoke");
    await waitForDebugRuntime(page);

    await expect(page).toHaveTitle("Orbit Breaker");
    const canvas = page.locator("#gameCanvas");
    await expect(canvas).toBeVisible();
    await expect(page.locator("[role=alert]")).toHaveCount(0);

    const canvasState = await canvas.evaluate((element) => {
      const canvasElement = element as HTMLCanvasElement;
      const context = canvasElement.getContext("2d");
      if (context === null) {
        return { width: 0, height: 0, colors: 0 };
      }
      const pixels = context.getImageData(0, 0, canvasElement.width, canvasElement.height).data;
      const colors = new Set<string>();
      const stride = Math.max(4, Math.floor(pixels.length / 6000 / 4) * 4);
      for (let index = 0; index < pixels.length; index += stride) {
        colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}`);
      }
      return { width: canvasElement.width, height: canvasElement.height, colors: colors.size };
    });

    expect(canvasState.width).toBeGreaterThanOrEqual(960);
    expect(canvasState.height).toBeGreaterThanOrEqual(720);
    expect(canvasState.colors).toBeGreaterThan(3);
    expect((await snapshot(page)).state).toBe("title");
    expect(errors).toEqual([]);
  });

  test("starts, pauses, resumes, and restarts terminal routes", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/?seed=state-flow");
    await waitForDebugRuntime(page);

    await page.keyboard.press("Enter");
    await expectState(page, "playing");
    expect(await snapshot(page)).toMatchObject({ currentWave: 1, lives: 3 });

    await page.keyboard.press("KeyP");
    await expectState(page, "paused");
    const pausedState = await deterministicState(page);
    await page.waitForTimeout(100);
    expect(await deterministicState(page)).toBe(pausedState);

    await page.keyboard.press("Escape");
    await expectState(page, "playing");

    await page.evaluate(() => window.__ORBIT_DEBUG__?.forceState("gameOver"));
    await expectState(page, "gameOver");
    expect((await snapshot(page)).lives).toBe(0);
    await page.keyboard.press("Enter");
    await expectState(page, "playing");
    expect(await snapshot(page)).toMatchObject({ currentWave: 1, score: 0, lives: 3 });

    await page.evaluate(() => window.__ORBIT_DEBUG__?.dispatch({ type: "start-boss" }));
    await page.waitForFunction(() => {
      const value = window.__ORBIT_DEBUG__?.snapshot() as
        { bossHealth?: number | null } | undefined;
      return typeof value?.bossHealth === "number";
    });
    await page.evaluate(() => window.__ORBIT_DEBUG__?.forceState("victory"));
    await expectState(page, "victory");
    await page.keyboard.press("Enter");
    await expectState(page, "playing");
    expect(await snapshot(page)).toMatchObject({ currentWave: 1, score: 0, lives: 3 });

    expect(errors).toEqual([]);
  });

  test("passes the M1 input and damage gate across five fresh starts", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.goto("/?seed=m1-browser-controls");
    await waitForDebugRuntime(page);

    await page.keyboard.press("Enter");
    await expectState(page, "playing");

    let lastControlSnapshot: BrowserSnapshot | undefined;
    for (let cycle = 0; cycle < 5; cycle += 1) {
      expect(await snapshot(page)).toMatchObject({
        state: "playing",
        currentWave: 1,
        score: 0,
        lives: 3,
      });
      lastControlSnapshot = await exerciseOpeningControls(page);
      expect(lastControlSnapshot.run).toMatchObject({
        firstMoveSeconds: expect.any(Number),
        firstShotSeconds: expect.any(Number),
        firstDashSeconds: expect.any(Number),
      });
      expect(lastControlSnapshot.run.shotsFired).toBeGreaterThan(0);

      await page.waitForFunction(() => {
        const current = window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined;
        return current !== undefined && current.dashCooldown < 0.7;
      });
      await page.evaluate(() => window.__ORBIT_DEBUG__?.dispatch({ type: "spawn-player-contact" }));
      await page.waitForFunction(() => {
        const current = window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined;
        return current?.lives === 2 && current.run.lastDamageSource === "enemy-contact";
      });
      expect((await snapshot(page)).run).toMatchObject({
        damageTaken: 1,
        lastDamageSource: "enemy-contact",
      });

      await page.evaluate(() => window.__ORBIT_DEBUG__?.forceState("gameOver"));
      await expectState(page, "gameOver");
      if (cycle === 4) {
        break;
      }
      await page.keyboard.press("Enter");
      await expectState(page, "playing");
    }

    expect(lastControlSnapshot).toBeDefined();
    const terminalSnapshot = await snapshot(page);
    expect(terminalSnapshot).toMatchObject({
      state: "gameOver",
      run: {
        damageTaken: 1,
        lastDamageSource: "enemy-contact",
        firstMoveSeconds: expect.any(Number),
        firstShotSeconds: expect.any(Number),
        firstDashSeconds: expect.any(Number),
      },
    });
    expect(terminalSnapshot.run.elapsedSeconds).toBeGreaterThan(0);
    expect(terminalSnapshot.run.shotsFired).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("continues when Web Audio is unavailable", async ({ page }) => {
    const errors = collectBrowserErrors(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, "AudioContext", { value: undefined, configurable: true });
      Object.defineProperty(window, "webkitAudioContext", {
        value: undefined,
        configurable: true,
      });
    });
    await page.goto("/?seed=no-audio");
    await waitForDebugRuntime(page);
    await page.keyboard.press("Enter");
    await expectState(page, "playing");
    expect(errors).toEqual([]);
  });
});

async function exerciseOpeningControls(page: Page): Promise<BrowserSnapshot> {
  const beforeMovement = await snapshot(page);
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("Space");
  await page.waitForFunction((initialAngle) => {
    const current = window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined;
    if (current === undefined) {
      return false;
    }
    const fullTurn = Math.PI * 2;
    const rawDistance = Math.abs(current.playerAngle - initialAngle) % fullTurn;
    const distance = Math.min(rawDistance, fullTurn - rawDistance);
    return distance > 0.08 && current.playerShots > 0;
  }, beforeMovement.playerAngle);
  const afterMovement = await snapshot(page);
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowRight");

  expect(angleDistance(afterMovement.playerAngle, beforeMovement.playerAngle)).toBeGreaterThan(
    0.08,
  );
  expect(afterMovement.playerShots).toBeGreaterThan(0);

  const beforeReversal = await snapshot(page);
  await page.keyboard.down("ArrowLeft");
  await waitForAngularMovement(page, beforeReversal.playerAngle, 0.08);
  await page.keyboard.up("ArrowLeft");
  const afterReversal = await snapshot(page);
  expect(angleDistance(afterReversal.playerAngle, beforeReversal.playerAngle)).toBeGreaterThan(
    0.08,
  );

  await page.waitForTimeout(180);
  const shotsBeforeTap = (await snapshot(page)).run.shotsFired;
  await page.keyboard.press("Space");
  await page.waitForFunction((initialShots) => {
    const current = window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined;
    return current !== undefined && current.run.shotsFired > initialShots;
  }, shotsBeforeTap);

  await page.keyboard.press("KeyP");
  await expectState(page, "paused");
  await page.keyboard.press("Escape");
  await expectState(page, "playing");

  const beforeDash = await snapshot(page);
  await page.keyboard.press("ShiftLeft");
  await waitForAngularMovement(page, beforeDash.playerAngle, 0.4);
  const afterDash = await snapshot(page);

  expect(angleDistance(afterDash.playerAngle, beforeDash.playerAngle)).toBeGreaterThan(0.4);
  expect(afterDash.dashCooldown).toBeGreaterThan(0.7);

  await page.waitForFunction(() => {
    const current = window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined;
    return current !== undefined && current.dashCooldown > 0.06 && current.dashCooldown <= 0.12;
  });
  const beforeBufferedDash = await snapshot(page);
  await page.keyboard.press("ShiftLeft");
  await waitForAngularMovement(page, beforeBufferedDash.playerAngle, 0.4);
  const afterBufferedDash = await snapshot(page);

  expect(beforeBufferedDash.dashCooldown).toBeGreaterThan(0);
  expect(
    angleDistance(afterBufferedDash.playerAngle, beforeBufferedDash.playerAngle),
  ).toBeGreaterThan(0.4);
  expect(afterBufferedDash.dashCooldown).toBeGreaterThan(0.7);
  return afterBufferedDash;
}

async function waitForAngularMovement(
  page: Page,
  initialAngle: number,
  minimumDistance: number,
): Promise<void> {
  await page.waitForFunction(
    ({ angle, distance }) => {
      const current = window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined;
      if (current === undefined) {
        return false;
      }
      const fullTurn = Math.PI * 2;
      const rawDistance = Math.abs(current.playerAngle - angle) % fullTurn;
      return Math.min(rawDistance, fullTurn - rawDistance) > distance;
    },
    { angle: initialAngle, distance: minimumDistance },
  );
}

async function waitForDebugRuntime(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__ORBIT_DEBUG__ !== undefined);
}

async function snapshot(page: Page): Promise<BrowserSnapshot> {
  return page.evaluate(() => window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot);
}

async function deterministicState(page: Page): Promise<string> {
  return page.evaluate(() => window.__ORBIT_DEBUG__?.deterministicState() ?? "");
}

async function expectState(page: Page, expected: string): Promise<void> {
  await page.waitForFunction(
    (state) => (window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined)?.state === state,
    expected,
  );
}

function angleDistance(left: number, right: number): number {
  const fullTurn = Math.PI * 2;
  const rawDistance = Math.abs(left - right) % fullTurn;
  return Math.min(rawDistance, fullTurn - rawDistance);
}

function collectBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  return errors;
}
