const UINT32_RANGE = 0x1_0000_0000;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MULBERRY_INCREMENT = 0x6d2b79f5;

export type RandomSeed = number | string;

export interface RandomSource {
  next(): number;
  range(minInclusive: number, maxExclusive: number): number;
  integer(minInclusive: number, maxExclusive: number): number;
  chance(probability: number): boolean;
  choose<T>(values: readonly T[]): T;
}

export interface RandomStreams {
  readonly gameplay: SeededRng;
  readonly presentation: RandomSource;
}

export interface RngSnapshot {
  readonly state: number;
}

abstract class RandomSourceBase implements RandomSource {
  abstract next(): number;

  range(minInclusive: number, maxExclusive: number): number {
    assertFiniteBounds(minInclusive, maxExclusive);
    if (maxExclusive < minInclusive) {
      throw new RangeError("maxExclusive must be greater than or equal to minInclusive");
    }
    return minInclusive + this.next() * (maxExclusive - minInclusive);
  }

  integer(minInclusive: number, maxExclusive: number): number {
    if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxExclusive)) {
      throw new TypeError("integer bounds must be safe integers");
    }
    if (maxExclusive <= minInclusive) {
      throw new RangeError("maxExclusive must be greater than minInclusive");
    }
    return Math.floor(this.range(minInclusive, maxExclusive));
  }

  chance(probability: number): boolean {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new RangeError("probability must be between 0 and 1");
    }
    return this.next() < probability;
  }

  choose<T>(values: readonly T[]): T {
    if (values.length === 0) throw new RangeError("cannot choose from an empty collection");
    return values[this.integer(0, values.length)] as T;
  }
}

export class SeededRng extends RandomSourceBase {
  readonly initialSeed: number;
  private state: number;

  constructor(seed: RandomSeed) {
    super();
    this.initialSeed = normalizeSeed(seed);
    this.state = this.initialSeed;
  }

  next(): number {
    this.state = (this.state + MULBERRY_INCREMENT) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  }

  snapshot(): RngSnapshot {
    return { state: this.state };
  }

  restore(snapshot: RngSnapshot): void {
    if (
      !Number.isSafeInteger(snapshot.state) ||
      snapshot.state < 0 ||
      snapshot.state >= UINT32_RANGE
    ) {
      throw new RangeError("snapshot state must be an unsigned 32-bit integer");
    }
    this.state = snapshot.state >>> 0;
  }

  reset(): void {
    this.state = this.initialSeed;
  }

  clone(): SeededRng {
    const clone = new SeededRng(this.initialSeed);
    clone.state = this.state;
    return clone;
  }
}

export class SystemRng extends RandomSourceBase {
  next(): number {
    return Math.random();
  }
}

export function createRandomStreams(
  gameplaySeed: RandomSeed,
  presentation: RandomSource = new SystemRng(),
): RandomStreams {
  return { gameplay: new SeededRng(gameplaySeed), presentation };
}

export function normalizeSeed(seed: RandomSeed): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) throw new TypeError("numeric seeds must be finite");
    return Math.trunc(seed) >>> 0;
  }

  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

function assertFiniteBounds(min: number, max: number): void {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new TypeError("random bounds must be finite");
  }
}
