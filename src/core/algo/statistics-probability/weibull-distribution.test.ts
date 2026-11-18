/**
 * weibull-distribution.test.ts - Independent formula and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./weibull-distribution";
import type { VisualFrame } from "@/types";

const pdf = (x: number, k: number, lambda: number): number => {
  if (x <= 0) return k === 1 ? 1 / lambda : 0;
  const t = x / lambda;
  return (k / lambda) * Math.pow(t, k - 1) * Math.exp(-Math.pow(t, k));
};
const cdf = (x: number, k: number, lambda: number): number =>
  x <= 0 ? 0 : 1 - Math.exp(-Math.pow(x / lambda, k));
const quantile = (u: number, k: number, lambda: number): number =>
  lambda * Math.pow(-Math.log(1 - u), 1 / k);

function checkFrames(frames: VisualFrame[]): void {
  expect(frames.length).toBeGreaterThan(1);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("array");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    expect(frame.entities.every((e) => e.metadata.row === 0)).toBe(true);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Weibull distribution", () => {
  const input = { shape: 2, scale: 1.5, xMax: 7.5, bins: 16, samples: 300, seed: 42 };

  it("matches independent density and CDF formulas at every bin", () => {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    const step = input.xMax / input.bins;
    for (let i = 0; i < input.bins; i += 1) {
      const frame = frames[1 + i];
      const x = (i + 0.5) * step;
      expect(frame?.meta["x"] as number).toBeCloseTo(x, 10);
      expect(frame?.meta["density"] as number).toBeCloseTo(pdf(x, input.shape, input.scale), 12);
      expect(frame?.meta["cdf"] as number).toBeCloseTo(cdf(x, input.shape, input.scale), 12);
      expect(frame?.entities[i]?.value as number).toBeCloseTo(pdf(x, input.shape, input.scale), 12);
    }
  });

  it("has a density that integrates to one", () => {
    const slices = 100000;
    const upper = 12;
    let total = 0;
    for (let i = 0; i <= slices; i += 1) {
      const x = (i / slices) * upper;
      const w = i === 0 || i === slices ? 0.5 : 1;
      total += w * pdf(x, input.shape, input.scale);
    }
    expect((total * upper) / slices).toBeCloseTo(1, 4);
  });

  it("inverts the CDF exactly for every inverse-transform draw", () => {
    const frames = [...mod.run(input)];
    const meta = frames[frames.length - 1]?.meta;
    const us = meta?.["sampleU"] as number[];
    const xs = meta?.["sampleX"] as number[];
    expect(us.length).toBe(12);
    expect(xs.length).toBe(12);
    for (let i = 0; i < us.length; i += 1) {
      const u = us[i] as number;
      const x = xs[i] as number;
      expect(x).toBeCloseTo(quantile(u, input.shape, input.scale), 12);
      expect(cdf(x, input.shape, input.scale)).toBeCloseTo(u, 10);
    }
  });

  it("computes the integrated mean and closed-form median", () => {
    const frames = [...mod.run(input)];
    const meta = frames[frames.length - 1]?.meta;
    const slices = 100000;
    const upper = input.xMax;
    let weighted = 0;
    for (let i = 0; i <= slices; i += 1) {
      const x = (i / slices) * upper;
      const w = i === 0 || i === slices ? 0.5 : 1;
      weighted += w * x * pdf(x, input.shape, input.scale);
    }
    expect(meta?.["mean"] as number).toBeCloseTo((weighted * upper) / slices, 3);
    expect(meta?.["median"] as number).toBeCloseTo(
      quantile(0.5, input.shape, input.scale),
      12,
    );
  });

  it("reduces to the exponential distribution when shape is one", () => {
    const frames = [...mod.run({ ...input, shape: 1, bins: 8, samples: 5, seed: 1 })];
    const c = frames[2]?.meta["cdf"] as number;
    const x = frames[2]?.meta["x"] as number;
    expect(c).toBeCloseTo(1 - Math.exp(-x / input.scale), 12);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
