/**
 * generalized-linear-model.test.ts - Independent score and brute-force checks.
 */
import { describe, expect, it } from "vitest";
import mod, { glmIRLS, sigmoid, solveLinear } from "./generalized-linear-model";
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

const X = [
  [1, -1.5],
  [1, -1],
  [1, -0.5],
  [1, 0],
  [1, 0.5],
  [1, 1],
  [1, 1.5],
];
const y = [0, 0, 0, 1, 0, 1, 1];

describe("Generalized linear model (IRLS)", () => {
  it("solves a linear system correctly", () => {
    const solution = solveLinear(
      [
        [2, 1],
        [1, 3],
      ],
      [5, 10],
    );
    expect(solution[0]).toBeCloseTo(1, 10);
    expect(solution[1]).toBeCloseTo(3, 10);
  });

  it("increases the log likelihood each step", () => {
    const fit = glmIRLS(X, y, 20);
    for (let i = 1; i < fit.trace.length; i += 1) {
      expect(fit.trace[i] as number).toBeGreaterThanOrEqual((fit.trace[i - 1] as number) - 1e-9);
    }
    expect(fit.converged).toBe(true);
  });

  it("satisfies the score equations at the fitted coefficients", () => {
    const fit = glmIRLS(X, y, 30);
    const p = fit.beta.length;
    for (let j = 0; j < p; j += 1) {
      let score = 0;
      for (let i = 0; i < X.length; i += 1) {
        const eta = (X[i] as number[]).reduce(
          (sum, value, k) => sum + value * (fit.beta[k] as number),
          0,
        );
        score += (X[i] as number[])[j]! * ((y[i] as number) - sigmoid(eta));
      }
      expect(Math.abs(score)).toBeLessThan(0.02);
    }
  });

  it("matches a brute-force grid search on the fitted likelihood", () => {
    const fit = glmIRLS(X, y, 40);
    const best = glmIRLS(X, y, 40).trace.at(-1) as number;
    let gridBest = -Infinity;
    for (let a = -3; a <= 3.001; a += 0.1) {
      for (let b = -1; b <= 5.001; b += 0.1) {
        let ll = 0;
        for (let i = 0; i < X.length; i += 1) {
          const eta = a + b * (X[i] as number[])[1]!;
          const mu = sigmoid(eta);
          const clipped = Math.min(1 - 1e-12, Math.max(1e-12, mu));
          ll += (y[i] as number) * Math.log(clipped) + (1 - (y[i] as number)) * Math.log(1 - clipped);
        }
        if (ll > gridBest) gridBest = ll;
      }
    }
    expect(best).toBeCloseTo(fit.trace.at(-1) as number, 12);
    expect(best).toBeGreaterThanOrEqual(gridBest - 1e-6);
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
