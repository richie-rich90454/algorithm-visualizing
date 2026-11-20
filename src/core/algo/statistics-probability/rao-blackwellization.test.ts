/**
 * rao-blackwellization.test.ts - Independent moment and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, {
  compareEstimators,
  normalSample,
  raoBlackwellize,
} from "./rao-blackwellization";
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

describe("Rao-Blackwellization", () => {
  it("equals the sample mean and preserves the first draw", () => {
    const samples = [1, 2, 3, 4, 5];
    const pair = raoBlackwellize(samples);
    expect(pair.crude).toBe(1);
    expect(pair.conditional).toBeCloseTo(3, 12);
    expect(pair.sufficient).toBe(pair.conditional);
  });

  it("draws deterministic seeded normals", () => {
    expect(normalSample(20, 42)).toEqual(normalSample(20, 42));
    expect(normalSample(20, 42)).not.toEqual(normalSample(20, 43));
  });

  it("keeps both estimators unbiased", () => {
    const result = compareEstimators(4000, 9, 123, 2);
    const meanCrude = result.crude.reduce((a, b) => a + b, 0) / result.crude.length;
    const meanCond = result.conditional.reduce((a, b) => a + b, 0) / result.conditional.length;
    expect(meanCrude).toBeCloseTo(2, 1);
    expect(meanCond).toBeCloseTo(2, 1);
  });

  it("reduces variance to approximately 1/n", () => {
    const result = compareEstimators(6000, 16, 77, 0);
    expect(result.conditionalVariance).toBeCloseTo(1 / 16, 1);
    expect(result.crudeVariance).toBeCloseTo(1, 1);
    expect(result.conditionalVariance).toBeLessThan(result.crudeVariance * 0.25);
  });

  it("emits well-formed frames and terminates", () => {
    const frames = [...mod.run(mod.defaultInput)];
    checkFrames(frames);
    const meta = frames.at(-1)?.meta;
    expect(meta?.["conditionalVariance"] as number).toBeCloseTo(meta?.["targetVariance"] as number, 1);
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
