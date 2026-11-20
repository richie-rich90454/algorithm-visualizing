/**
 * frechet-distribution.test.ts - Independent formula and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, { frechetCdf, frechetPdf, frechetQuantile } from "./frechet-distribution";
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

describe("Frechet distribution", () => {
  const input = { alpha: 2, scale: 1.2, location: 0, xMax: 10, bins: 16, samples: 300, seed: 11 };

  it("inverts the CDF exactly for every sample", () => {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    const meta = frames[frames.length - 1]?.meta;
    const us = meta?.["sampleU"] as number[];
    const xs = meta?.["sampleX"] as number[];
    expect(us.length).toBe(10);
    for (let i = 0; i < us.length; i += 1) {
      const u = us[i] as number;
      expect(frechetQuantile(u, 2, 1.2, 0)).toBeCloseTo(xs[i] as number, 10);
      expect(frechetCdf(xs[i] as number, 2, 1.2, 0)).toBeCloseTo(u, 10);
    }
    expect(meta?.["median"] as number).toBeCloseTo(frechetQuantile(0.5, 2, 1.2, 0), 12);
  });

  it("has a density equal to the numerical derivative of the CDF", () => {
    const h = 1e-5;
    for (const x of [0.6, 1.2, 2.5, 5]) {
      const derivative = (frechetCdf(x + h, 2, 1.2, 0) - frechetCdf(x - h, 2, 1.2, 0)) / (2 * h);
      expect(derivative).toBeCloseTo(frechetPdf(x, 2, 1.2, 0), 7);
    }
  });

  it("integrates to one above the location", () => {
    const slices = 200000;
    const upper = 400;
    const lower = 1e-6;
    let total = 0;
    for (let i = 0; i <= slices; i += 1) {
      const x = lower + (i / slices) * (upper - lower);
      const w = i === 0 || i === slices ? 0.5 : 1;
      total += w * frechetPdf(x, 2, 1.2, 0);
    }
    expect((total * (upper - lower)) / slices).toBeCloseTo(1, 3);
  });

  it("respects the location and is zero below it", () => {
    expect(frechetCdf(2, 2, 1, 5)).toBe(0);
    expect(frechetPdf(2, 2, 1, 5)).toBe(0);
    expect(frechetQuantile(0.5, 2, 1, 5)).toBeCloseTo(5 + Math.pow(Math.log(2), -0.5), 10);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
