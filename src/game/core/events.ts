export type AudioCue =
  | "fire"
  | "enemyHit"
  | "enemyDestroyed"
  | "drifterSignal"
  | "spiralSignal"
  | "mineSignal"
  | "shooterSignal"
  | "hunterSignal"
  | "shieldSignal"
  | "shooterFire"
  | "playerHit"
  | "powerup"
  | "waveClear"
  | "bossWarning"
  | "bossShieldBlock"
  | "bossHit"
  | "bossWeakOpen"
  | "bossBeamFire"
  | "bossPhase"
  | "bossDefeated"
  | "gameOver"
  | "dash"
  | "bomb";

export type VisualEffectKind = "ring" | "burst" | "bomb" | "bossPulse";

export type EffectPosition =
  | Readonly<{ coordinateSpace: "cartesian"; x: number; y: number }>
  | Readonly<{ angle: number; coordinateSpace: "polar"; radius: number }>;

export interface VisualEffectRequest {
  readonly kind: VisualEffectKind;
  readonly position: EffectPosition;
  readonly color: string;
  readonly size: number;
  readonly durationSeconds: number;
}

export interface CameraShakeRequest {
  readonly intensity: number;
  readonly durationSeconds: number;
}

export type UiNoticeKind =
  "title" | "wave-clear" | "boss-intro" | "paused" | "game-over" | "victory";

export interface UiNoticeRequest {
  readonly kind: UiNoticeKind;
  readonly message?: string;
}

export type MetricTagValue = boolean | number | string;

export interface MetricEvent {
  readonly name: string;
  readonly value: number;
  readonly tags?: Readonly<Record<string, MetricTagValue>>;
}

export interface GameplayEventMap {
  readonly audio: Readonly<{ cue: AudioCue }>;
  readonly effect: VisualEffectRequest;
  readonly "camera-shake": CameraShakeRequest;
  readonly "ui-notice": UiNoticeRequest;
  readonly metric: MetricEvent;
}

type EventKey<EventMap extends object> = Extract<keyof EventMap, string>;

export type TypedEvent<EventMap extends object, Key extends EventKey<EventMap>> =
  Key extends EventKey<EventMap>
    ? Readonly<{ payload: EventMap[Key]; sequence: number; type: Key }>
    : never;

export type EventUnion<EventMap extends object> = {
  [Key in EventKey<EventMap>]: TypedEvent<EventMap, Key>;
}[EventKey<EventMap>];

export class TypedEventQueue<EventMap extends object> {
  private events: EventUnion<EventMap>[] = [];
  private nextSequence = 0;

  get size(): number {
    return this.events.length;
  }

  emit<Key extends EventKey<EventMap>>(
    type: Key,
    payload: EventMap[Key],
  ): TypedEvent<EventMap, Key> {
    const event = { payload, sequence: this.nextSequence, type } as TypedEvent<EventMap, Key>;
    this.nextSequence += 1;
    this.events.push(event as EventUnion<EventMap>);
    return event;
  }

  peek(): readonly EventUnion<EventMap>[] {
    return this.events.slice();
  }

  drain(): EventUnion<EventMap>[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  clear(): void {
    this.events = [];
  }

  reset(): void {
    this.clear();
    this.nextSequence = 0;
  }
}

export const GameplayEventQueue = TypedEventQueue<GameplayEventMap>;
