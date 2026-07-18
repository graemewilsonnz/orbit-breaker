import { CONFIG } from "../config";
import { clamp, polarToCartesian, type Point } from "../core/geometry";
import type { ReadonlyEffectState } from "../state";

function getEffectPosition(effect: ReadonlyEffectState): Point {
  if (effect.x !== undefined) {
    return {
      x: effect.x,
      y: effect.y ?? CONFIG.arena.centerY,
    };
  }

  return polarToCartesian(
    effect.angle ?? 0,
    effect.radius ?? 0,
    CONFIG.arena.centerX,
    CONFIG.arena.centerY,
  );
}

export function renderEffects(
  context: CanvasRenderingContext2D,
  effects: readonly ReadonlyEffectState[],
): void {
  for (const effect of effects) {
    const progress = clamp(effect.duration > 0 ? effect.age / effect.duration : 1, 0, 1);
    const position = getEffectPosition(effect);
    const color = effect.color || CONFIG.colors.player;

    context.save();
    context.shadowColor = color;
    context.lineCap = "round";

    switch (effect.type) {
      case "bomb":
        drawBomb(context, position, effect.size, progress, color);
        break;
      case "bossPulse":
        drawBossPulse(context, position, effect.size, progress, color);
        break;
      case "burst":
        drawBurst(context, position, effect.size, progress, color);
        break;
      case "ring":
        drawRing(context, position, effect.size, progress, color);
        break;
    }

    context.restore();
  }
}

function drawBurst(
  context: CanvasRenderingContext2D,
  position: Point,
  size: number,
  progress: number,
  color: string,
): void {
  const alpha = 1 - progress;
  const eased = easeOutCubic(progress);
  const phase = positiveModulo(position.x * 0.017 + position.y * 0.013, CONFIG.TAU);

  context.shadowBlur = 22 * alpha;
  context.fillStyle = color;
  context.globalAlpha = alpha * alpha * 0.38;
  context.beginPath();
  context.arc(position.x, position.y, size * (0.28 + eased * 0.34), 0, CONFIG.TAU);
  context.fill();

  context.globalAlpha = alpha * 0.94;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1.5 + alpha * 1.8;
  context.beginPath();
  context.arc(position.x, position.y, size * (0.2 + eased * 0.72), 0, CONFIG.TAU);
  context.stroke();

  context.strokeStyle = color;
  context.lineWidth = 1.4 + alpha * 1.9;
  for (let index = 0; index < 9; index += 1) {
    const angle = phase + (index * CONFIG.TAU) / 9;
    const stagger = index % 3 === 0 ? 1 : 0.74;
    const innerRadius = size * (0.16 + eased * 0.5) * stagger;
    const sparkLength = size * (0.1 + alpha * 0.26) * stagger;
    const outerRadius = innerRadius + sparkLength;
    context.beginPath();
    context.moveTo(
      position.x + Math.cos(angle) * innerRadius,
      position.y + Math.sin(angle) * innerRadius,
    );
    context.lineTo(
      position.x + Math.cos(angle) * outerRadius,
      position.y + Math.sin(angle) * outerRadius,
    );
    context.stroke();
  }
}

function drawRing(
  context: CanvasRenderingContext2D,
  position: Point,
  size: number,
  progress: number,
  color: string,
): void {
  const alpha = 1 - progress;
  const radius = size * (0.32 + easeOutCubic(progress) * 0.68);
  context.strokeStyle = color;
  context.shadowBlur = 16 * alpha;
  context.globalAlpha = alpha * 0.82;
  context.lineWidth = 2.2 + alpha * 1.8;
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, CONFIG.TAU);
  context.stroke();

  context.globalAlpha = alpha * 0.34;
  context.lineWidth = 1.2;
  context.beginPath();
  context.arc(position.x, position.y, radius * 0.68, 0, CONFIG.TAU);
  context.stroke();
}

function drawBossPulse(
  context: CanvasRenderingContext2D,
  position: Point,
  size: number,
  progress: number,
  color: string,
): void {
  const alpha = 1 - progress;
  const eased = easeOutCubic(progress);
  context.strokeStyle = color;
  context.shadowBlur = 26 * alpha;
  context.globalAlpha = alpha * 0.86;
  context.lineWidth = 3 + alpha * 2;

  for (const scale of [0.58, 0.82, 1]) {
    context.globalAlpha = alpha * (1.12 - scale) * 1.7;
    context.beginPath();
    context.arc(position.x, position.y, size * eased * scale, 0, CONFIG.TAU);
    context.stroke();
  }

  context.globalAlpha = alpha * 0.55;
  context.lineWidth = 2;
  for (let index = 0; index < 4; index += 1) {
    const angle = (index * CONFIG.TAU) / 4 + progress * 0.35;
    const innerRadius = size * eased * 0.38;
    const outerRadius = size * eased;
    context.beginPath();
    context.moveTo(
      position.x + Math.cos(angle) * innerRadius,
      position.y + Math.sin(angle) * innerRadius,
    );
    context.lineTo(
      position.x + Math.cos(angle) * outerRadius,
      position.y + Math.sin(angle) * outerRadius,
    );
    context.stroke();
  }
}

function drawBomb(
  context: CanvasRenderingContext2D,
  position: Point,
  size: number,
  progress: number,
  color: string,
): void {
  const alpha = 1 - progress;
  const radius = size * easeOutCubic(progress);
  const wash = context.createRadialGradient(
    position.x,
    position.y,
    0,
    position.x,
    position.y,
    Math.max(1, radius),
  );
  wash.addColorStop(0, "rgba(255, 255, 255, 0.32)");
  wash.addColorStop(0.35, color);
  wash.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.globalAlpha = alpha * 0.22;
  context.fillStyle = wash;
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, CONFIG.TAU);
  context.fill();

  context.globalAlpha = alpha * 0.92;
  context.strokeStyle = color;
  context.shadowBlur = 24 * alpha;
  context.lineWidth = 3 + alpha * 2;
  context.beginPath();
  context.arc(position.x, position.y, radius, 0, CONFIG.TAU);
  context.stroke();

  context.globalAlpha = alpha * 0.5;
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(position.x, position.y, radius * 0.73, 0, CONFIG.TAU);
  context.stroke();
}

function easeOutCubic(value: number): number {
  const inverse = 1 - value;
  return 1 - inverse * inverse * inverse;
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
