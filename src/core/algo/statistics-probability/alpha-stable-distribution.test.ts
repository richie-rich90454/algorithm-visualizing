/**
 * alpha-stable-distribution.test.ts - Independent special-case and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, { stableCharacteristic, stablePdf } from "./alpha-stable-distribution";
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

describe("Alpha-stable distribution", () => {
  const input = { alpha: 1.5, sigma: 1, xMax: 6, bins: 32 };

  it("has a characteristic function equal to one at zero and even", () => {
    expect(stableCharacteristic(0, 1.5, 1)).toBeCloseTo(1, 12);
    expect(stableCharacteristic(-2, 1.3, 0.7)).toBeCloseTo(stableCharacteristic(2, 1.3, 0.7), 12);
  });

  it("reduces to the normal N(0, 2 sigma squared) when alpha is two", () => {
    const sigma = 1;
    for (const x of [0, 0.5, 1.5, 3]) {
      const expected = Math.exp((-x * x) / (4 * sigma * sigma)) / (2 * sigma * Math.sqrt(Math.PI));
      expect(stablePdf(x, 2, sigma)).toBeCloseTo(expected, 3);
    }
  });

  it("reduces to the Cauchy law when alpha is one", () => {
    const sigma = 1;
    for (const x of [0, 0.5, 1.5, 3]) {
      const expected = sigma / (Math.PI * (sigma * sigma + x * x));
      expect(stablePdf(x, 1, sigma)).toBeCloseTo(expected, 3);
    }
  });

  it("is symmetric and heavier-tailed for smaller alpha", () => {
    expect(stablePdf(1.2, 1.4, 1)).toBeCloseTo(stablePdf(-1.2, 1.4, 1), 6);
    const ratioHeavy = stablePdf(4, 1.1, 1) / stablePdf(0, 1.1, 1);
    const ratioLight = stablePdf(4, 1.9, 1) / stablePdf(0, 1.9, 1);
    expect(ratioHeavy).toBeGreaterThan(ratioLight);
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
