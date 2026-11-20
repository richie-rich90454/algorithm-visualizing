/**
 * erlang-distribution.test.ts - Independent formula and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, { erlangCdf, erlangPdf, erlangQuantile } from "./erlang-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
  expect(frames.length).toBeGreaterThan(1);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("array");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    expect(frame.edges).toEqual([]);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

function poissonTail(k: number, mean: number): number {
  let lower = 0;
  let term = Math.exp(-mean);
  for (let j = 0; j < k; j += 1) {
    if (j > 0) term = (term * mean) / j;
    lower += term;
  }
  return 1 - lower;
}

describe("Erlang distribution", () => {
  const input = { shape: 3, rate: 1.5, xMax: 5, bins: 16, samples: 300, seed: 7 };

  it("matches an independent Poisson-tail CDF on a grid", () => {
    for (const k of [1, 2, 3, 5, 8]) {
      for (const x of [0.1, 0.5, 1, 2, 4, 8]) {
        expect(erlangCdf(x, k, 1.5)).toBeCloseTo(poissonTail(k, 1.5 * x), 12);
      }
    }
  });

  it("matches the convolution density for shape two", () => {
    for (const x of [0.2, 0.7, 1.5, 3]) {
      const lambda = 2;
      expect(erlangPdf(x, 2, lambda)).toBeCloseTo(lambda * lambda * x * Math.exp(-lambda * x), 12);
    }
  });

  it("has a density that integrates to one", () => {
    const slices = 100000;
    const upper = 20;
    let total = 0;
    for (let i = 0; i <= slices; i += 1) {
      const x = (i / slices) * upper;
      const w = i === 0 || i === slices ? 0.5 : 1;
      total += w * erlangPdf(x, 3, 1.5);
    }
    expect((total * upper) / slices).toBeCloseTo(1, 4);
  });

  it("inverts the CDF for every sample", () => {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    const meta = frames[frames.length - 1]?.meta;
    const us = meta?.["sampleU"] as number[];
    const xs = meta?.["sampleX"] as number[];
    expect(us.length).toBe(10);
    for (let i = 0; i < us.length; i += 1) {
      expect(erlangCdf(xs[i] as number, input.shape, input.rate)).toBeCloseTo(us[i] as number, 9);
    }
    expect(meta?.["mean"] as number).toBeCloseTo(input.shape / input.rate, 12);
  });

  it("reduces to the exponential distribution when shape is one", () => {
    for (const x of [0.3, 1, 2.5]) {
      expect(erlangCdf(x, 1, 2)).toBeCloseTo(1 - Math.exp(-2 * x), 12);
      expect(erlangPdf(x, 1, 2)).toBeCloseTo(2 * Math.exp(-2 * x), 12);
    }
    expect(erlangQuantile(0.5, 1, 2)).toBeCloseTo(Math.log(2) / 2, 9);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
