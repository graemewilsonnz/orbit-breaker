import { describe, expect, it } from "vitest";

import { SeededRng, createRandomStreams, normalizeSeed } from "../../src/game/core/rng";

function take(rng: SeededRng, count: number): number[] {
  return Array.from({ length: count }, () => rng.next());
}

describe("SeededRng", () => {
  it("repeats the same sequence for the same number or string seed", () => {
    expect(take(new SeededRng(42), 8)).toEqual(take(new SeededRng(42), 8));
    expect(take(new SeededRng("m0-parity"), 8)).toEqual(take(new SeededRng("m0-parity"), 8));
    expect(take(new SeededRng(42), 4)).not.toEqual(take(new SeededRng(43), 4));
  });

  it("normalizes seeds to stable unsigned 32-bit values", () => {
    expect(normalizeSeed(4_294_967_297)).toBe(1);
    expect(normalizeSeed(-1)).toBe(4_294_967_295);
    expect(normalizeSeed("orbit-breaker")).toBe(normalizeSeed("orbit-breaker"));
    expect(() => normalizeSeed(Number.NaN)).toThrow(TypeError);
  });

  it("restores, resets, and clones stream state", () => {
    const rng = new SeededRng("restore-me");
    rng.next();
    const snapshot = rng.snapshot();
    const expected = take(rng, 4);
    rng.restore(snapshot);
    expect(take(rng, 4)).toEqual(expected);

    const clone = rng.clone();
    expect(take(clone, 4)).toEqual(take(rng, 4));
    rng.reset();
    expect(rng.next()).toBe(new SeededRng("restore-me").next());
  });

  it("provides checked range, integer, chance, and choice helpers", () => {
    const rng = new SeededRng(123);
    expect(rng.range(5, 5)).toBe(5);
    expect(rng.integer(2, 3)).toBe(2);
    expect(["a", "b", "c"]).toContain(rng.choose(["a", "b", "c"]));
    expect(typeof rng.chance(0.5)).toBe("boolean");
    expect(() => rng.integer(3, 3)).toThrow(RangeError);
    expect(() => rng.choose([])).toThrow(RangeError);
    expect(() => rng.chance(1.1)).toThrow(RangeError);
  });

  it("keeps presentation consumption isolated from gameplay outcomes", () => {
    const presentation = new SeededRng("presentation");
    const streams = createRandomStreams("gameplay", presentation);
    const control = new SeededRng("gameplay");
    expect(streams.gameplay.next()).toBe(control.next());
    take(presentation, 50);
    expect(streams.gameplay.next()).toBe(control.next());
  });
});
