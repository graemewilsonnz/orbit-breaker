export const ACTIONS = ["left", "right", "fire", "dash", "bomb", "pause", "enter"] as const;

export type Action = (typeof ACTIONS)[number];
export type InputAction = Action;

export const KEY_BINDINGS: Readonly<Record<string, Action>> = Object.freeze({
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "fire",
  KeyZ: "fire",
  ShiftLeft: "dash",
  ShiftRight: "dash",
  KeyX: "dash",
  KeyB: "bomb",
  KeyC: "bomb",
  KeyP: "pause",
  Escape: "pause",
  Enter: "enter",
  NumpadEnter: "enter",
});

export type ActionState = Readonly<Record<Action, boolean>>;

type MutableActionState = Record<Action, boolean>;

export interface InputSnapshot {
  readonly held: ActionState;
  readonly pressed: ActionState;
  isDown(action: Action): boolean;
  wasPressed(action: Action): boolean;
  isActive(action: Action): boolean;
}

export interface InputSnapshotOptions {
  readonly held?: Iterable<Action>;
  readonly pressed?: Iterable<Action>;
}

export interface InputManagerOptions {
  readonly target?: EventTarget | null;
  readonly onAudioUnlock?: (() => void) | undefined;
}

export function actionForKeyCode(code: string): Action | null {
  return KEY_BINDINGS[code] ?? null;
}

/** Alias retained for callers that describe the lookup as a key mapping. */
export const keyToAction = actionForKeyCode;

/**
 * Creates an immutable snapshot for scenario tests, replays, and debug tools.
 * A pressed action does not have to be held: a complete tap can happen between
 * two simulation steps.
 */
export function createInputSnapshot(options: InputSnapshotOptions = {}): InputSnapshot {
  const held = createActionState();
  const pressed = createActionState();

  for (const action of options.held ?? []) {
    held[action] = true;
  }
  for (const action of options.pressed ?? []) {
    pressed[action] = true;
  }

  return freezeSnapshot(held, pressed);
}

export const EMPTY_INPUT_SNAPSHOT = createInputSnapshot();

/**
 * Converts browser events into fixed-step input snapshots.
 *
 * Key edges are cleared by consumeStep(), not by rendering. This means an edge
 * survives a render frame that performs no simulation step, while only the
 * first step of a catch-up frame observes it.
 */
export class InputManager {
  private readonly held = createActionState();
  private readonly latched = createActionState();
  private target: EventTarget | null = null;
  private onAudioUnlock: (() => void) | undefined;

  private readonly handleKeyDown = (event: Event): void => {
    const action = actionForKeyCode(readKeyCode(event));
    if (action === null) {
      return;
    }

    event.preventDefault();
    this.injectPress(action);
    this.onAudioUnlock?.();
  };

  private readonly handleKeyUp = (event: Event): void => {
    const action = actionForKeyCode(readKeyCode(event));
    if (action === null) {
      return;
    }

    event.preventDefault();
    this.injectRelease(action);
  };

  private readonly handleBlur = (): void => {
    this.clear();
  };

  constructor(options: InputManagerOptions = {}) {
    this.onAudioUnlock = options.onAudioUnlock;
    if (options.target) {
      this.bind(options.target);
    }
  }

  bind(target: EventTarget): void {
    if (this.target === target) {
      return;
    }

    this.unbind();
    this.target = target;
    target.addEventListener("keydown", this.handleKeyDown);
    target.addEventListener("keyup", this.handleKeyUp);
    target.addEventListener("blur", this.handleBlur);
  }

  unbind(): void {
    if (this.target) {
      this.target.removeEventListener("keydown", this.handleKeyDown);
      this.target.removeEventListener("keyup", this.handleKeyUp);
      this.target.removeEventListener("blur", this.handleBlur);
      this.target = null;
    }
    this.clear();
  }

  dispose(): void {
    this.unbind();
    this.onAudioUnlock = undefined;
  }

  setAudioUnlockCallback(callback: (() => void) | undefined): void {
    this.onAudioUnlock = callback;
  }

  /** Returns one simulation step's input and consumes its pending edges. */
  consumeStep(): InputSnapshot {
    const snapshot = freezeSnapshot(this.held, this.latched);
    clearActionState(this.latched);
    return snapshot;
  }

  /** Observes pending input without consuming it. Intended for diagnostics. */
  peekSnapshot(): InputSnapshot {
    return freezeSnapshot(this.held, this.latched);
  }

  isHeld(action: Action): boolean {
    return this.held[action];
  }

  isPressPending(action: Action): boolean {
    return this.latched[action];
  }

  /** Injects the equivalent of a physical key-down for tests/debug tools. */
  injectPress(action: Action): void {
    if (!this.held[action]) {
      this.latched[action] = true;
    }
    this.held[action] = true;
  }

  /** Injects the equivalent of a physical key-up for tests/debug tools. */
  injectRelease(action: Action): void {
    this.held[action] = false;
  }

  /** Injects a full key tap, including an edge, between simulation steps. */
  injectTap(action: Action): void {
    this.injectRelease(action);
    this.injectPress(action);
    this.injectRelease(action);
  }

  injectHeld(action: Action, held: boolean): void {
    if (held) {
      this.injectPress(action);
    } else {
      this.injectRelease(action);
    }
  }

  clear(): void {
    clearActionState(this.held);
    clearActionState(this.latched);
  }
}

function readKeyCode(event: Event): string {
  const code = (event as Event & { readonly code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function createActionState(): MutableActionState {
  return {
    left: false,
    right: false,
    fire: false,
    dash: false,
    bomb: false,
    pause: false,
    enter: false,
  };
}

function copyActionState(source: ActionState): MutableActionState {
  const copy = createActionState();
  for (const action of ACTIONS) {
    copy[action] = source[action];
  }
  return copy;
}

function clearActionState(state: MutableActionState): void {
  for (const action of ACTIONS) {
    state[action] = false;
  }
}

function freezeSnapshot(heldSource: ActionState, pressedSource: ActionState): InputSnapshot {
  const held = Object.freeze(copyActionState(heldSource));
  const pressed = Object.freeze(copyActionState(pressedSource));

  return Object.freeze({
    held,
    pressed,
    isDown: (action: Action): boolean => held[action],
    wasPressed: (action: Action): boolean => pressed[action],
    isActive: (action: Action): boolean => held[action] || pressed[action],
  });
}
