/**
 * nested-sampling.test.ts - Independent evidence and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, { nestedEvidence } from "./nested-sampling";
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

describe("Nested sampling", () => {
  it("matches the analytic evidence for a uniform prior with linear likelihood", () => {
    const n = 2000;
    const volumes = Array.from({ length: n + 1 }, (_, i) => 1 - i / n);
    const logLikelihoods = Array.from({ length: n }, (_, i) => Math.log(i / n));
    const result = nestedEvidence(logLikelihoods, volumes);
    expect(result.z).toBeCloseTo((n - 1) / (2 * n), 4);
    expect(result.logZ).toBeCloseTo(Math.log(result.z), 10);
  });

  it("sums contributions exactly and keeps them nonnegative", () => {
    const result = nestedEvidence([Math.log(0.1), Math.log(0.5), Math.log(2)]);
    const sum = result.contributions.reduce((a, b) => a + b, 0);
    expect(result.z).toBeCloseTo(sum, 12);
    expect(result.contributions.every((c) => c >= 0)).toBe(true);
    expect(result.volumes.length).toBe(4);
    expect(result.volumes[0]).toBeCloseTo(1, 12);
  });

  it("increases the evidence as the likelihood ladder improves", () => {
    const volumes = [1, 0.7, 0.4, 0.1, 0];
    const low = nestedEvidence([Math.log(0.2), Math.log(0.4), Math.log(0.6), Math.log(0.8)], volumes);
    const high = nestedEvidence([Math.log(1), Math.log(2), Math.log(3), Math.log(4)], volumes);
    expect(high.z).toBeGreaterThan(low.z);
    expect(high.logZ).toBeGreaterThan(low.logZ);
  });

  it("emits well-formed frames and terminates", () => {
    const frames = [...mod.run(mod.defaultInput)];
    checkFrames(frames);
    const meta = frames.at(-1)?.meta;
    const contributions = meta?.["contributions"] as number[];
    expect(contributions.reduce((a, b) => a + b, 0)).toBeCloseTo(meta?.["z"] as number, 10);
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
