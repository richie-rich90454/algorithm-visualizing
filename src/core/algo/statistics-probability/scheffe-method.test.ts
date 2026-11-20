/**
 * scheffe-method.test.ts - Independent formula and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, { scheffeHalfWidth, scheffePairwise } from "./scheffe-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
  expect(frames.length).toBeGreaterThan(1);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("array");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(frame.edges).toEqual([]);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Scheffe method", () => {
  const input = {
    means: [4, 5, 6, 5.5],
    sampleSizes: [10, 10, 10, 10],
    mse: 2,
    fCritical: 3.24,
    tCritical: 2.06,
  };

  it("matches an independently written half-width formula", () => {
    for (const k of [2, 3, 5]) {
      for (const mse of [0.5, 2, 7]) {
        const expected = Math.sqrt((k - 1) * 3.24 * mse * (1 / 8 + 1 / 12));
        expect(scheffeHalfWidth(mse, 8, 12, k, 3.24)).toBeCloseTo(expected, 12);
      }
    }
  });

  it("centers every interval on its contrast and keeps endpoints ordered", () => {
    const intervals = scheffePairwise(input);
    expect(intervals.length).toBe(6);
    for (const v of intervals) {
      expect((v.lower + v.upper) / 2).toBeCloseTo(v.difference, 12);
      expect(v.upper).toBeGreaterThanOrEqual(v.lower);
      expect((input.means[v.i] as number) - (input.means[v.j] as number)).toBeCloseTo(v.difference, 12);
    }
  });

  it("reduces to the t interval for two groups when F equals t squared", () => {
    const t = 2.1;
    const intervals = scheffePairwise({
      means: [3, 4],
      sampleSizes: [7, 9],
      mse: 1.7,
      fCritical: t * t,
      tCritical: t,
    });
    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.halfWidth).toBeCloseTo(intervals[0]?.tHalfWidth as number, 12);
  });

  it("is always at least as wide as the individual t interval when k exceeds two", () => {
    const intervals = scheffePairwise(input);
    for (const v of intervals) {
      expect(v.halfWidth).toBeGreaterThanOrEqual(v.tHalfWidth);
    }
  });

  it("emits well-formed frames and terminates", () => {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
