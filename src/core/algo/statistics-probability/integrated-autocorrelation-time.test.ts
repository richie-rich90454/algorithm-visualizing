/**
 * integrated-autocorrelation-time.test.ts - Independent AR(1) and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, {
  ar1Chain,
  autocorrelation,
  integratedAutocorrelationTime,
} from "./integrated-autocorrelation-time";
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

describe("Integrated autocorrelation time", () => {
  it("has unit autocorrelation at lag zero and decays for AR(1)", () => {
    const chain = ar1Chain(5000, 0.6, 11);
    expect(autocorrelation(chain, 0)).toBeCloseTo(1, 12);
    expect(autocorrelation(chain, 1)).toBeGreaterThan(autocorrelation(chain, 5));
    expect(autocorrelation(chain, 5)).toBeGreaterThan(0);
  });

  it("stays near the analytic AR(1) integrated autocorrelation time", () => {
    for (const phi of [0.3, 0.7, 0.85]) {
      const analytic = (1 + phi) / (1 - phi);
      const chain = ar1Chain(50000, phi, 19);
      const result = integratedAutocorrelationTime(chain, Math.ceil(8 * analytic));
      expect(result.tau).toBeGreaterThan(0);
      expect(Math.abs(result.tau - analytic) / analytic).toBeLessThan(0.25);
    }
  });

  it("keeps effective sample size consistent with tau", () => {
    const chain = ar1Chain(2000, 0.5, 7);
    const result = integratedAutocorrelationTime(chain, 30);
    expect(result.effectiveSampleSize).toBeCloseTo(2000 / result.tau, 10);
    expect(result.effectiveSampleSize).toBeLessThanOrEqual(2000);
    expect(result.groups.length).toBeGreaterThan(0);
  });

  it("emits well-formed frames and terminates", () => {
    const frames = [...mod.run(mod.defaultInput)];
    checkFrames(frames);
    const meta = frames.at(-1)?.meta;
    const tau = meta?.["tau"] as number;
    const analytic = meta?.["analytic"] as number;
    expect(Math.abs(tau - analytic) / analytic).toBeLessThan(0.3);
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
