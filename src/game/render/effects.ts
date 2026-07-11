import { CONFIG } from "../config";
import { polarToCartesian, type Point } from "../core/geometry";
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
    const progress = effect.duration > 0 ? effect.age / effect.duration : 1;
    const alpha = Math.max(0, 1 - progress);
    const position = getEffectPosition(effect);
    const color = effect.color || CONFIG.colors.player;

    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = effect.type === "bomb" ? 4 : 3;
    context.shadowColor = color;
    context.shadowBlur = 18;

    if (effect.type === "bomb") {
      context.beginPath();
      context.arc(position.x, position.y, effect.size * progress, 0, CONFIG.TAU);
      context.stroke();
      context.globalAlpha = alpha * 0.16;
      context.beginPath();
      context.arc(position.x, position.y, effect.size * progress * 0.72, 0, CONFIG.TAU);
      context.fill();
    } else if (effect.type === "bossPulse") {
      context.beginPath();
      context.arc(position.x, position.y, effect.size * progress, 0, CONFIG.TAU);
      context.stroke();
    } else {
      context.beginPath();
      context.arc(position.x, position.y, effect.size * (0.25 + progress), 0, CONFIG.TAU);
      context.stroke();
    }

    context.restore();
  }
}
