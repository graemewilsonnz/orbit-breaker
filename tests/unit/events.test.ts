import { describe, expect, it } from "vitest";

import { GameplayEventQueue, TypedEventQueue } from "../../src/game/core/events";

describe("TypedEventQueue", () => {
  it("preserves event order and assigns monotonic sequence numbers", () => {
    interface TestEvents {
      readonly amount: Readonly<{ value: number }>;
      readonly label: Readonly<{ value: string }>;
    }

    const events = new TypedEventQueue<TestEvents>();
    const first = events.emit("amount", { value: 4 });
    const second = events.emit("label", { value: "wave-clear" });

    expect(first).toEqual({ payload: { value: 4 }, sequence: 0, type: "amount" });
    expect(second.sequence).toBe(1);
    expect(events.peek()).toEqual([first, second]);
  });

  it("drains events without resetting their sequence", () => {
    const events = new GameplayEventQueue();
    events.emit("audio", { cue: "fire" });

    expect(events.drain()).toEqual([{ payload: { cue: "fire" }, sequence: 0, type: "audio" }]);
    expect(events.size).toBe(0);
    expect(events.emit("camera-shake", { durationSeconds: 0.2, intensity: 0.4 }).sequence).toBe(1);
  });

  it("can clear pending events or fully reset the queue", () => {
    const events = new GameplayEventQueue();
    events.emit("ui-notice", { kind: "paused" });
    events.clear();
    expect(events.size).toBe(0);
    expect(events.emit("metric", { name: "wave", value: 1 }).sequence).toBe(1);

    events.reset();
    expect(events.size).toBe(0);
    expect(events.emit("audio", { cue: "dash" }).sequence).toBe(0);
  });
});
