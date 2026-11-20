/**
 * exponential-backoff-jitter.test.ts - Reference schedule and bound checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./exponential-backoff-jitter";
import type { VisualFrame } from "@/types";

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function reference(base: number, cap: number, retries: number, seed: number, strategy: string) {
  const rng = makeRng(seed);
  const ceilings: number[] = [];
  const delays: number[] = [];
  let previous = base;
  for (let i = 0; i < retries; i += 1) {
    const ceiling = Math.min(cap, base * 2 ** i);
    ceilings.push(ceiling);
    let delay: number;
    if (strategy === "full") delay = rng() * ceiling;
    else if (strategy === "equal") delay = ceiling / 2 + rng() * (ceiling / 2);
    else {
      delay = Math.min(ceiling, rng() * previous * 3);
      previous = delay;
    }
    delays.push(delay);
  }
  return { ceilings, delays, total: delays.reduce((a, b) => a + b, 0) };
}

function checkFrames(frames: VisualFrame[], retries: number): void {
  expect(frames.length).toBe(retries + 2);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("array");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBe(retries);
    expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Exponential backoff with jitter", () => {
  it("replicates an independent schedule for every strategy", () => {
    for (const strategy of ["full", "equal", "decorrelated"]) {
      const input = { base: 0.1, cap: 5, retries: 12, seed: 77, strategy };
      const frames = [...mod.run(input)];
      checkFrames(frames, input.retries);
      const ref = reference(input.base, input.cap, input.retries, input.seed, strategy);
      const meta = frames[frames.length - 1]?.meta;
      expect(meta?.["ceilings"] as number[]).toEqual(ref.ceilings);
      const delays = meta?.["delays"] as number[];
      expect(delays.length).toBe(ref.delays.length);
      for (let i = 0; i < delays.length; i += 1) {
        expect(delays[i]).toBeCloseTo(ref.delays[i] as number, 12);
      }
      expect(meta?.["total"] as number).toBeCloseTo(ref.total, 12);
    }
  });

  it("doubles the ceiling until the cap and keeps full jitter in bounds", () => {
    const input = { base: 0.5, cap: 4, retries: 12, seed: 5, strategy: "full" };
    const frames = [...mod.run(input)];
    const ceilings = frames[frames.length - 1]?.meta["ceilings"] as number[];
    expect(ceilings).toEqual([0.5, 1, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    for (const frame of frames) {
      const delay = frame.meta["delay"] as number | undefined;
      const ceiling = frame.meta["ceiling"] as number | undefined;
      if (delay !== undefined && ceiling !== undefined) {
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it("averages about half the cap when full jitter saturates", () => {
    const frames = [...mod.run({ base: 0.1, cap: 10, retries: 60, seed: 2026, strategy: "full" })] as VisualFrame[];
    const delays = frames[frames.length - 1]?.meta["delays"] as number[];
    const saturated = delays.slice(10);
    const mean = saturated.reduce((a, b) => a + b, 0) / saturated.length;
    expect(Math.abs(mean - 5)).toBeLessThan(1);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
