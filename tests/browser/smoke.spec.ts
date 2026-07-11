import { expect, test, type Page } from "@playwright/test";

interface BrowserSnapshot {
  readonly state: string;
  readonly currentWave: number;
  readonly score: number;
  readonly lives: number;
  readonly enemies: number;
  readonly pendingSpawns: number;
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
