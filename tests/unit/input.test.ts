import { describe, expect, it, vi } from "vitest";

import {
  ACTIONS,
  InputManager,
  actionForKeyCode,
  createInputSnapshot,
  type Action,
} from "../../src/game/systems/input";

const KEY_CASES: readonly (readonly [string, Action])[] = [
  ["ArrowLeft", "left"],
  ["KeyA", "left"],
  ["ArrowRight", "right"],
  ["KeyD", "right"],
  ["Space", "fire"],
  ["KeyZ", "fire"],
  ["ShiftLeft", "dash"],
  ["ShiftRight", "dash"],
  ["KeyX", "dash"],
  ["KeyB", "bomb"],
  ["KeyC", "bomb"],
  ["KeyP", "pause"],
  ["Escape", "pause"],
  ["Enter", "enter"],
  ["NumpadEnter", "enter"],
];

describe("keyboard bindings", () => {
  it.each(KEY_CASES)("maps %s to %s", (code, action) => {
    expect(actionForKeyCode(code)).toBe(action);
  });

  it("does not claim unrelated keys", () => {
    expect(actionForKeyCode("KeyQ")).toBeNull();
    expect(actionForKeyCode("")).toBeNull();
  });
});

describe("InputManager fixed-step snapshots", () => {
  it("tracks held state until release", () => {
    const input = new InputManager();

    input.injectPress("left");
    const first = input.consumeStep();
    const second = input.consumeStep();

    expect(first.isDown("left")).toBe(true);
    expect(first.wasPressed("left")).toBe(true);
    expect(second.isDown("left")).toBe(true);
    expect(second.wasPressed("left")).toBe(false);

    input.injectRelease("left");
    expect(input.consumeStep().isDown("left")).toBe(false);
  });

  it("keeps an edge latched across render frames with no simulation step", () => {
    const input = new InputManager();
    input.injectTap("pause");

    expect(input.peekSnapshot().wasPressed("pause")).toBe(true);
    expect(input.peekSnapshot().wasPressed("pause")).toBe(true);

    const eventualStep = input.consumeStep();
    expect(eventualStep.wasPressed("pause")).toBe(true);
    expect(eventualStep.isDown("pause")).toBe(false);
  });

  it("exposes an edge to only the first step of a multi-step catch-up", () => {
    const input = new InputManager();
    input.injectPress("dash");

    const catchUpSteps = [input.consumeStep(), input.consumeStep(), input.consumeStep()];

    expect(catchUpSteps.map((step) => step.wasPressed("dash"))).toEqual([true, false, false]);
    expect(catchUpSteps.every((step) => step.isDown("dash"))).toBe(true);
  });

  it("does not relatch an edge for repeated key-downs while held", () => {
    const input = new InputManager();
    input.injectPress("bomb");
    input.injectPress("bomb");

    expect(input.consumeStep().wasPressed("bomb")).toBe(true);
    expect(input.consumeStep().wasPressed("bomb")).toBe(false);

    input.injectRelease("bomb");
    input.injectPress("bomb");
    expect(input.consumeStep().wasPressed("bomb")).toBe(true);
  });

  it("clears both held actions and pending edges", () => {
    const input = new InputManager();
    input.injectPress("fire");
    input.injectTap("enter");

    input.clear();
    const snapshot = input.consumeStep();

    for (const action of ACTIONS) {
      expect(snapshot.isDown(action)).toBe(false);
      expect(snapshot.wasPressed(action)).toBe(false);
    }
  });
});

describe("InputManager browser event lifecycle", () => {
  it("prevents mapped keys, tracks key-up, and requests audio unlock", () => {
    const target = new EventTarget();
    const unlockAudio = vi.fn();
    const input = new InputManager({ target, onAudioUnlock: unlockAudio });

    const firstDown = dispatchKey(target, "keydown", "Space");
    const repeatedDown = dispatchKey(target, "keydown", "Space");
    const up = dispatchKey(target, "keyup", "Space");

    expect(firstDown.defaultPrevented).toBe(true);
    expect(repeatedDown.defaultPrevented).toBe(true);
    expect(up.defaultPrevented).toBe(true);
    expect(unlockAudio).toHaveBeenCalledTimes(2);

    const snapshot = input.consumeStep();
    expect(snapshot.isDown("fire")).toBe(false);
    expect(snapshot.wasPressed("fire")).toBe(true);
  });

  it("ignores unrelated keyboard events", () => {
    const target = new EventTarget();
    const unlockAudio = vi.fn();
    const input = new InputManager({ target, onAudioUnlock: unlockAudio });

    const event = dispatchKey(target, "keydown", "KeyQ");

    expect(event.defaultPrevented).toBe(false);
    expect(unlockAudio).not.toHaveBeenCalled();
    const snapshot = input.peekSnapshot();
    for (const action of ACTIONS) {
      expect(snapshot.isDown(action)).toBe(false);
      expect(snapshot.wasPressed(action)).toBe(false);
    }
  });

  it("clears held state and unconsumed edges on blur", () => {
    const target = new EventTarget();
    const input = new InputManager({ target });
    dispatchKey(target, "keydown", "ArrowRight");
    dispatchKey(target, "keydown", "KeyB");

    target.dispatchEvent(new Event("blur"));
    const snapshot = input.consumeStep();

    expect(snapshot.isDown("right")).toBe(false);
    expect(snapshot.wasPressed("right")).toBe(false);
    expect(snapshot.isDown("bomb")).toBe(false);
    expect(snapshot.wasPressed("bomb")).toBe(false);
  });

  it("removes listeners when disposed", () => {
    const target = new EventTarget();
    const unlockAudio = vi.fn();
    const input = new InputManager({ target, onAudioUnlock: unlockAudio });

    input.dispose();
    dispatchKey(target, "keydown", "Enter");

    expect(unlockAudio).not.toHaveBeenCalled();
    expect(input.consumeStep().wasPressed("enter")).toBe(false);
  });
});

describe("input injection helpers", () => {
  it("creates immutable snapshots for simulation tests and debug commands", () => {
    const snapshot = createInputSnapshot({
      held: ["left", "fire"],
      pressed: ["dash"],
    });

    expect(snapshot.isDown("left")).toBe(true);
    expect(snapshot.isDown("fire")).toBe(true);
    expect(snapshot.wasPressed("dash")).toBe(true);
    expect(snapshot.isDown("dash")).toBe(false);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.held)).toBe(true);
    expect(Object.isFrozen(snapshot.pressed)).toBe(true);
  });

  it("can replace the audio unlock callback without changing injected input", () => {
    const firstUnlock = vi.fn();
    const secondUnlock = vi.fn();
    const target = new EventTarget();
    const input = new InputManager({ target, onAudioUnlock: firstUnlock });

    input.setAudioUnlockCallback(secondUnlock);
    input.injectTap("enter");

    expect(input.consumeStep().wasPressed("enter")).toBe(true);
    expect(firstUnlock).not.toHaveBeenCalled();
    expect(secondUnlock).not.toHaveBeenCalled();
  });
});

function dispatchKey(target: EventTarget, type: "keydown" | "keyup", code: string): Event {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, "code", { value: code });
  target.dispatchEvent(event);
  return event;
}
