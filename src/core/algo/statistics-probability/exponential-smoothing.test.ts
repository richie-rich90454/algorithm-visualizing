/**
 * exponential-smoothing.test.ts - Independent recurrence and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./exponential-smoothing";
import type { VisualFrame } from "@/types";

function referenceLevels(series: number[], alpha: number): number[] {
  if (series.length === 0) return [];
  const levels = [series[0] as number];
  for (let t = 1; t < series.length; t += 1) {
    levels.push(alpha * (series[t] as number) + (1 - alpha) * (levels[t - 1] as number));
  }
  return levels;
}

function checkFrames(frames: VisualFrame[], n: number): void {
  expect(frames.length).toBe(n + 2);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("point");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBe(n + Math.min(index, n));
    expect(frame.entities.every((e) => e.type === "node")).toBe(true);
    expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Exponential smoothing", () => {
  const input = { series: [3, 5, 4, 7, 6, 8, 7, 9, 10, 8], alpha: 0.4 };

  it("matches an independent level recursion exactly", () => {
    const frames = [...mod.run(input)];
    checkFrames(frames, input.series.length);
    const expected = referenceLevels(input.series, input.alpha);
    const meta = frames[frames.length - 1]?.meta;
    const levels = meta?.["levels"] as number[];
    expect(levels.length).toBe(expected.length);
    for (let t = 0; t < expected.length; t += 1) {
      expect(levels[t]).toBeCloseTo(expected[t] as number, 12);
    }
    expect(meta?.["forecast"] as number).toBeCloseTo(expected[expected.length - 1] as number, 12);
  });

  it("honors the limiting alpha values", () => {
    const one = [...mod.run({ series: [2, 9, 4, 8], alpha: 1 })];
    expect(one[one.length - 1]?.meta["levels"] as number[]).toEqual([2, 9, 4, 8]);
    const zero = [...mod.run({ series: [2, 9, 4, 8], alpha: 0 })];
    expect(zero[zero.length - 1]?.meta["levels"] as number[]).toEqual([2, 2, 2, 2]);
  });

  it("computes the one-step squared error total independently", () => {
    const frames = [...mod.run(input)];
    const levels = referenceLevels(input.series, input.alpha);
    let sse = 0;
    for (let t = 1; t < input.series.length; t += 1) {
      const error = input.series[t]! - levels[t - 1]!;
      sse += error * error;
    }
    expect(frames[frames.length - 1]?.meta["sse"] as number).toBeCloseTo(sse, 12);
  });

  it("stays between the previous level and observation on every step", () => {
    const frames = [...mod.run(input)];
    for (let t = 2; t < frames.length - 1; t += 1) {
      const meta = frames[t]?.meta;
      const previous = meta?.["previousLevel"] as number;
      const observation = meta?.["observation"] as number;
      const level = meta?.["level"] as number;
      expect(level).toBeGreaterThanOrEqual(Math.min(previous, observation) - 1e-12);
      expect(level).toBeLessThanOrEqual(Math.max(previous, observation) + 1e-12);
    }
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
