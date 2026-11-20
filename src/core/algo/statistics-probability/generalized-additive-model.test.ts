/**
 * generalized-additive-model.test.ts - Independent fit and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, { binSmoother, gamBackfit } from "./generalized-additive-model";
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

describe("Generalized additive model", () => {
  it("returns binwise means of the residual", () => {
    const xs = [0, 1, 2, 3, 4, 5];
    const residuals = [2, 4, 6, 8, 10, 12];
    const smoothed = binSmoother(xs, residuals, 3);
    expect(smoothed[0]).toBeCloseTo(3, 10);
    expect(smoothed[3]).toBeCloseTo(7, 10);
    expect(smoothed[5]).toBeCloseTo(11, 10);
  });

  it("fits deterministically with additive fitted values", () => {
    const x = Array.from({ length: 60 }, (_, i) => {
      const v = -3 + (6 * i) / 59;
      return [v, v * v];
    });
    const y = x.map((row) => Math.sin((row[0] as number) * 1.5));
    const a = gamBackfit(x, y, 10, 6);
    const b = gamBackfit(x, y, 10, 6);
    expect(a.fitted).toEqual(b.fitted);
    expect(a.fitted).toHaveLength(60);
    a.fitted.forEach((value, i) => {
      const sum = a.components.reduce((total, comp) => total + (comp[i] as number), 0);
      expect(value).toBeCloseTo(sum, 10);
    });
  });

  it("never increases the residual sum of squares", () => {
    const x = Array.from({ length: 50 }, (_, i) => [i / 49, ((i % 7) - 3) / 3]);
    const y = x.map((row) => Math.cos((row[0] as number) * 4) + 0.5 * (row[1] as number));
    const fit = gamBackfit(x, y, 8, 12);
    for (let i = 1; i < fit.rssTrace.length; i += 1) {
      expect(fit.rssTrace[i] as number).toBeLessThanOrEqual((fit.rssTrace[i - 1] as number) + 1e-9);
    }
  });

  it("beats a constant-mean baseline on nonlinear data", () => {
    const x = Array.from({ length: 80 }, (_, i) => {
      const v = -4 + (8 * i) / 79;
      return [v, Math.cos(v)];
    });
    const y = x.map((row) => Math.sin((row[0] as number) * 2));
    const baseline = y.reduce((a, b) => a + (b - y.reduce((s, v) => s + v, 0) / y.length) ** 2, 0);
    const fit = gamBackfit(x, y, 12, 10);
    expect(fit.rssTrace.at(-1) as number).toBeLessThan(baseline * 0.2);
  });

  it("emits well-formed frames and terminates", () => {
    const frames = [...mod.run(mod.defaultInput)];
    checkFrames(frames);
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
