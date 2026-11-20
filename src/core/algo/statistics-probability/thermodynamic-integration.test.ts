/**
 * thermodynamic-integration.test.ts - Independent integration and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, {
  expectedLogLikelihood,
  gaussianEvidenceViaTI,
  simpsonIntegral,
  trapezoidalIntegral,
} from "./thermodynamic-integration";
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

describe("Thermodynamic integration", () => {
  it("integrates a linear function exactly with the trapezoid rule", () => {
    const xs = [0, 0.25, 0.5, 0.9, 1];
    const values = xs.map((x) => 3 + 2 * x);
    expect(trapezoidalIntegral(xs, values)).toBeCloseTo(3 + 1, 10);
  });

  it("integrates a quadratic function exactly with Simpson's rule", () => {
    const values = [0, 1, 2, 3, 4].map((i) => 1 + 2 * (i / 4) + 3 * (i / 4) ** 2);
    expect(simpsonIntegral(values, 0, 1)).toBeCloseTo(1 + 1 + 1, 10);
  });

  it("matches the closed-form Gaussian evidence", () => {
    for (const mean of [0, 1, 2]) {
      const evidence = gaussianEvidenceViaTI(101, 1, 1, mean);
      const closed = Math.exp(-(mean * mean) / 4) / Math.sqrt(4 * Math.PI);
      expect(evidence).toBeCloseTo(closed, 4);
    }
  });

  it("computes the closed-form expected log likelihood at beta zero and one", () => {
    const atZero = expectedLogLikelihood(0, 0, 1, 1, 1);
    const atOne = expectedLogLikelihood(1, 0, 1, 1, 1);
    const expectedZero = -0.5 * Math.log(2 * Math.PI) - 0.5 * (1 + 1);
    const expectedOne = -0.5 * Math.log(2 * Math.PI) - 0.5 * (0.5 + 0.25);
    expect(atZero).toBeCloseTo(expectedZero, 10);
    expect(atOne).toBeCloseTo(expectedOne, 10);
    expect(atOne).toBeGreaterThan(atZero);
  });

  it("emits well-formed frames whose evidence matches the closed form", () => {
    const frames = [...mod.run(mod.defaultInput)];
    checkFrames(frames);
    const meta = frames.at(-1)?.meta;
    expect(meta?.["evidence"] as number).toBeCloseTo(meta?.["closedForm"] as number, 4);
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
