/**
 * johnson-su-distribution.test.ts - Independent formula and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, {
  erf,
  johnsonSuCdf,
  johnsonSuPdf,
  johnsonSuQuantile,
  normalCdf,
} from "./johnson-su-distribution";
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

describe("Johnson SU distribution", () => {
  const input = { gamma: 0, delta: 1, xi: 0, sigma: 1, xMax: 6, bins: 16, samples: 200, seed: 23 };

  it("approximates the standard error function", () => {
    expect(erf(0)).toBeCloseTo(0, 12);
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("inverts the CDF for every sample", () => {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    const meta = frames[frames.length - 1]?.meta;
    const us = meta?.["sampleU"] as number[];
    const xs = meta?.["sampleX"] as number[];
    expect(us.length).toBe(10);
    for (let i = 0; i < us.length; i += 1) {
      expect(johnsonSuCdf(xs[i] as number, 0, 1, 0, 1)).toBeCloseTo(us[i] as number, 4);
    }
  });

  it("has a density equal to the numerical derivative of the CDF", () => {
    const h = 1e-5;
    for (const x of [-2, -0.5, 0.3, 1.7]) {
      const derivative =
        (johnsonSuCdf(x + h, 0.4, 1.2, 0.5, 1.1) - johnsonSuCdf(x - h, 0.4, 1.2, 0.5, 1.1)) /
        (2 * h);
      expect(derivative).toBeCloseTo(johnsonSuPdf(x, 0.4, 1.2, 0.5, 1.1), 5);
    }
  });

  it("integrates to one over the real line", () => {
    const slices = 200000;
    const upper = 200;
    let total = 0;
    for (let i = 0; i <= slices; i += 1) {
      const x = -upper + (i / slices) * (2 * upper);
      const w = i === 0 || i === slices ? 0.5 : 1;
      total += w * johnsonSuPdf(x, -0.5, 0.8, 1, 1.4);
    }
    expect((total * (2 * upper)) / slices).toBeCloseTo(1, 3);
  });

  it("is symmetric when gamma and xi are zero", () => {
    for (const x of [0.5, 1.2, 2.4]) {
      expect(johnsonSuCdf(-x, 0, 1, 0, 1) + johnsonSuCdf(x, 0, 1, 0, 1)).toBeCloseTo(1, 5);
      expect(johnsonSuPdf(-x, 0, 1, 0, 1)).toBeCloseTo(johnsonSuPdf(x, 0, 1, 0, 1), 5);
    }
    expect(johnsonSuQuantile(0.5, 0, 1, 0, 1)).toBeCloseTo(0, 6);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
