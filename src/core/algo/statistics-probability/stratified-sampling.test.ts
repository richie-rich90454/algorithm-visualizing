/**
 * stratified-sampling.test.ts - Independent variance and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, {
  simpleMcEstimate,
  stratifiedEstimate,
  stratifiedUniforms,
} from "./stratified-sampling";
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

function variance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
}

describe("Stratified sampling", () => {
  it("places one uniform sample inside each stratum", () => {
    const samples = stratifiedUniforms(10, 42);
    expect(samples).toHaveLength(10);
    samples.forEach((x, i) => {
      expect(x).toBeGreaterThanOrEqual(i / 10);
      expect(x).toBeLessThan((i + 1) / 10);
    });
    expect(stratifiedUniforms(10, 42)).toEqual(samples);
  });

  it("matches the explicit average formula for any seed", () => {
    for (const seed of [1, 7, 99]) {
      const result = stratifiedEstimate(25, seed);
      const expected = result.samples.reduce((a, b) => a + b, 0) / 25;
      expect(result.estimate).toBeCloseTo(expected, 12);
    }
  });

  it("has unbiased expectation one half for the linear integrand", () => {
    let total = 0;
    const reps = 2000;
    for (let seed = 1; seed <= reps; seed += 1) total += stratifiedEstimate(16, seed).estimate;
    expect(total / reps).toBeCloseTo(0.5, 3);
  });

  it("reduces variance relative to plain Monte Carlo", () => {
    const strat: number[] = [];
    const simple: number[] = [];
    for (let seed = 1; seed <= 1500; seed += 1) {
      strat.push(stratifiedEstimate(16, seed).estimate);
      simple.push(simpleMcEstimate(16, seed));
    }
    expect(variance(strat)).toBeLessThan(variance(simple) * 0.5);
  });

  it("emits well-formed frames and terminates", () => {
    const frames = [...mod.run(mod.defaultInput)];
    checkFrames(frames);
    const meta = frames.at(-1)?.meta;
    expect(meta?.["estimate"] as number).toBeCloseTo(
      (meta?.["samples"] as number[]).reduce((a, b) => a + b, 0) / (meta?.["samples"] as number[]).length,
      12,
    );
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
