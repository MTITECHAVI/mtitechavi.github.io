export function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function coarsePointer(): boolean {
  return window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function dprScale(maxDpr = 2): number {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return clamp(dpr, 1, maxDpr);
}

