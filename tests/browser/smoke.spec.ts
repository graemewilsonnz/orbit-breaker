import { expect, test, type Page } from "@playwright/test";

interface BrowserSnapshot {
  readonly state: string;
  readonly pausedFrom: string;
  readonly pauseReason: string;
  readonly currentWave: number;
  readonly score: number;
  readonly lives: number;
  readonly playerAngle: number;
  readonly playerShots: number;
  readonly dashCooldown: number;
  readonly enemies: number;
  readonly pendingSpawns: number;
  readonly bossHealth: number | null;
  readonly bossPhase: number | null;
  readonly bossShieldMode: string | null;
  readonly bossElapsed: number | null;
  readonly bossPhaseElapsed: number | null;
  readonly bossTransitionTimer: number | null;
  readonly bossWeakAngle: number | null;
  readonly bossBeamActive: boolean;
  readonly bossBeamCount: number;
  readonly bossSafeArcCount: number;
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

  test("renders the M4 aperture and beam warning, then freezes the encounter while paused", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = collectBrowserErrors(page);
    await page.goto("/?seed=m4-browser-flow");
    await waitForDebugRuntime(page);
    await page.evaluate(() => {
      window.__ORBIT_DEBUG__?.dispatch({ type: "start-boss" });
      window.__ORBIT_DEBUG__?.dispatch({ type: "set-invulnerable", enabled: true });
    });
    await page.waitForFunction(() => {
      const current = window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined;
      return current?.bossShieldMode === "opening" && typeof current.bossWeakAngle === "number";
    });

    const opening = await snapshot(page);
    expect(opening).toMatchObject({
      state: "playing",
      bossHealth: expect.any(Number),
      bossPhase: 1,
      bossShieldMode: "opening",
      bossBeamCount: 0,
      bossSafeArcCount: 0,
    });
    expect(opening.bossWeakAngle).toEqual(expect.any(Number));
    const canvas = page.locator("#gameCanvas");
    const apertureFrame = await canvas.screenshot();
    expect(apertureFrame.byteLength).toBeGreaterThan(1_000);

    await page.evaluate(() =>
      window.__ORBIT_DEBUG__?.dispatch({ type: "set-time-scale", scale: 2 }),
    );
    await page.waitForFunction(() => {
      const current = window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined;
      return (
        current !== undefined &&
        current.bossBeamCount > 0 &&
        current.bossSafeArcCount === current.bossBeamCount &&
        !current.bossBeamActive
      );
    });

    const warning = await snapshot(page);
    expect(warning).toMatchObject({
      state: "playing",
      bossPhase: 1,
      bossBeamActive: false,
      bossBeamCount: 2,
      bossSafeArcCount: 2,
    });
    const warningFrame = await canvas.screenshot();
    expect(warningFrame.equals(apertureFrame)).toBe(false);

    await page.keyboard.press("KeyP");
    await expectState(page, "paused");
    const paused = await snapshot(page);
    const pausedState = await deterministicState(page);
    await page.waitForTimeout(150);

    expect(await deterministicState(page)).toBe(pausedState);
    expect((await snapshot(page)).bossElapsed).toBe(paused.bossElapsed);
    const pausedFrame = await canvas.screenshot();
    expect(pausedFrame.equals(warningFrame)).toBe(false);

    await page.keyboard.press("Escape");
    await expectState(page, "playing");
    expect(errors).toEqual([]);
  });

  test("passes the M1 input and damage gate across five fresh starts", async ({ page }) => {
    test.setTimeout(90_000);
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

  test("persists M5 settings, auto-pauses safely, and fits target desktop viewports", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const errors = collectBrowserErrors(page);
    await page.goto("/?seed=m5-complete-ux");
    await waitForDebugRuntime(page);

    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      const stage = page.locator("#gameStage");
      const canvas = page.locator("#gameCanvas");
      const stageBox = await stage.boundingBox();
      const canvasBox = await canvas.boundingBox();
      expect(stageBox).not.toBeNull();
      expect(canvasBox).not.toBeNull();
      expect(requiredBox(stageBox).x).toBeGreaterThanOrEqual(0);
      expect(requiredBox(stageBox).y).toBeGreaterThanOrEqual(0);
      expect(requiredBox(stageBox).x + requiredBox(stageBox).width).toBeLessThanOrEqual(
        viewport.width,
      );
      expect(requiredBox(stageBox).y + requiredBox(stageBox).height).toBeLessThanOrEqual(
        viewport.height,
      );
      expect(requiredBox(canvasBox).width / requiredBox(canvasBox).height).toBeCloseTo(4 / 3, 2);
      expect((await canvas.screenshot()).byteLength).toBeGreaterThan(1_000);
    }

    await page.locator("#settingsButton").click();
    const panel = page.locator("#settingsPanel");
    await expect(panel).toBeVisible();
    const panelFit = await page.locator(".settings-card").evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(panelFit.scrollHeight).toBeLessThanOrEqual(panelFit.clientHeight + 1);

    await page.locator("#masterVolume").fill("25");
    await page.locator("#musicVolume").fill("35");
    await page.locator("#effectsVolume").fill("45");
    await page.locator("#muteToggle").check();
    await page.locator("#reducedShakeToggle").check();
    await expect(page.locator("#masterVolumeValue")).toHaveText("25%");
    await expect(page.locator("#muteButton")).toHaveAttribute("aria-pressed", "true");
    await page.locator("#doneSettingsButton").click();

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("orbit-breaker.preferences.v1");
      return raw === null ? null : (JSON.parse(raw) as Record<string, unknown>);
    });
    expect(stored).toMatchObject({
      masterVolume: 0.25,
      musicVolume: 0.35,
      effectsVolume: 0.45,
      muted: true,
      reducedShake: true,
    });

    await page.reload();
    await waitForDebugRuntime(page);
    await page.locator("#settingsButton").click();
    await expect(page.locator("#masterVolume")).toHaveValue("25");
    await expect(page.locator("#musicVolume")).toHaveValue("35");
    await expect(page.locator("#effectsVolume")).toHaveValue("45");
    await expect(page.locator("#muteToggle")).toBeChecked();
    await expect(page.locator("#reducedShakeToggle")).toBeChecked();
    await page.locator("#doneSettingsButton").click();

    await page.keyboard.press("Enter");
    await expectState(page, "playing");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expectState(page, "paused");
    expect(await snapshot(page)).toMatchObject({ pauseReason: "focus", pausedFrom: "playing" });

    await page.keyboard.press("KeyP");
    await expectState(page, "playing");
    await page.locator("#settingsButton").click();
    await expectState(page, "paused");
    expect(await snapshot(page)).toMatchObject({ pauseReason: "settings", pausedFrom: "playing" });
    await page.locator("#closeSettingsButton").click();
    await expectState(page, "paused");
    await page.keyboard.press("KeyP");
    await expectState(page, "playing");

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
  expect(afterDash.run.firstDashSeconds).toEqual(expect.any(Number));

  await page.evaluate(() => {
    window.__ORBIT_DEBUG__?.dispatch({ type: "set-time-scale", scale: 0 });
    window.__ORBIT_DEBUG__?.dispatch({ type: "set-dash-cooldown", seconds: 0.1 });
  });
  await page.waitForFunction(() => {
    const current = window.__ORBIT_DEBUG__?.snapshot() as BrowserSnapshot | undefined;
    return current?.dashCooldown === 0.1;
  });
  const beforeBufferedDash = await snapshot(page);
  await page.keyboard.press("ShiftLeft");
  await page.evaluate(() => window.__ORBIT_DEBUG__?.dispatch({ type: "set-time-scale", scale: 1 }));
  await waitForAngularMovement(page, beforeBufferedDash.playerAngle, 0.4);
  const afterBufferedDash = await snapshot(page);

  expect(beforeBufferedDash.dashCooldown).toBeGreaterThan(0);
  expect(
    angleDistance(afterBufferedDash.playerAngle, beforeBufferedDash.playerAngle),
  ).toBeGreaterThan(0.4);
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

function requiredBox<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected a visible element bounding box");
  }
  return value;
}
