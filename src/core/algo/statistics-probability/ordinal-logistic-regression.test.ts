/**
 * ordinal-logistic-regression.test.ts - Independent property and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, {
  fitOrdinal,
  ordinalLogLikelihood,
  ordinalProbs,
  sigmoid,
  type OrdinalDatum,
} from "./ordinal-logistic-regression";
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

describe("Ordinal logistic regression", () => {
  const data: OrdinalDatum[] = [
    { x: -1, y: 0 },
    { x: -0.5, y: 0 },
    { x: 0, y: 0 },
    { x: 0.3, y: 0 },
    { x: 0.5, y: 1 },
    { x: 1, y: 1 },
    { x: 1.2, y: 2 },
    { x: 1.5, y: 1 },
  ];

  it("matches an independently written cumulative-difference formula", () => {
    const thresholds = [-0.5, 1];
    const beta = 0.8;
    const x = 0.5;
    const p = ordinalProbs(thresholds, beta, x);
    const cum0 = 1 / (1 + Math.exp(-(thresholds[0] as number - beta * x)));
    const cum1 = 1 / (1 + Math.exp(-(thresholds[1] as number - beta * x)));
    expect(p[0]).toBeCloseTo(cum0, 12);
    expect(p[1]).toBeCloseTo(cum1 - cum0, 12);
    expect(p[2]).toBeCloseTo(1 - cum1, 12);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it("keeps every probability nonnegative and monotone cumulative", () => {
    for (const beta of [-2, 0, 1.3]) {
      const p = ordinalProbs([-1, 0, 1.5], beta, 0.7);
      expect(p.every((v) => v >= -1e-12)).toBe(true);
      let cum = 0;
      const cumulatives = p.slice(0, -1).map((v) => (cum += v));
      for (let i = 1; i < cumulatives.length; i += 1) {
        expect(cumulatives[i] as number).toBeGreaterThanOrEqual(cumulatives[i - 1] as number);
      }
      expect(sigmoid(0)).toBeCloseTo(0.5, 12);
    }
  });

  it("increases the log likelihood every gradient step", () => {
    const fit = fitOrdinal([-0.5, 1], 0.8, data, 40, 0.1);
    for (let i = 1; i < fit.trace.length; i += 1) {
      expect(fit.trace[i] as number).toBeGreaterThanOrEqual((fit.trace[i - 1] as number) - 1e-9);
    }
    expect(fit.logLikelihood).toBeGreaterThan(fit.trace[0] as number);
    expect(ordinalLogLikelihood(fit.thresholds, fit.beta, data)).toBeCloseTo(fit.logLikelihood, 10);
  });

  it("reaches a near-zero numerical gradient at the fitted optimum", () => {
    const fit = fitOrdinal([-0.5, 1], 0.8, data, 1000, 0.1);
    const h = 1e-6;
    const gradBeta =
      (ordinalLogLikelihood(fit.thresholds, fit.beta + h, data) -
        ordinalLogLikelihood(fit.thresholds, fit.beta - h, data)) /
      (2 * h);
    expect(Math.abs(gradBeta)).toBeLessThan(0.02);
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
