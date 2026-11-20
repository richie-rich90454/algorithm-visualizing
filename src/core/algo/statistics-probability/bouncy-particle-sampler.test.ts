/**
 * bouncy-particle-sampler.test.ts - Independent hazard and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, {
  bpsStep,
  bpsTrajectory,
  bounceRate,
  cumulativeHazard,
  eventTime,
} from "./bouncy-particle-sampler";
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

describe("Bouncy particle sampler", () => {
  it("computes the nonnegative bounce rate", () => {
    expect(bounceRate(2, 1)).toBe(2);
    expect(bounceRate(-2, 1)).toBe(0);
    expect(bounceRate(2, -1)).toBe(0);
    expect(bounceRate(-2, -1)).toBe(2);
  });

  it("inverts the cumulative hazard exactly for positive and negative initial rates", () => {
    for (const a of [-3, -0.5, 0, 1.5, 4]) {
      for (const u of [0.05, 0.3, 0.8]) {
        const tau = eventTime(a, u);
        expect(tau).toBeGreaterThan(0);
        expect(cumulativeHazard(a, tau)).toBeCloseTo(-Math.log(u), 5);
      }
    }
  });

  it("moves and reflects correctly on each step", () => {
    const step = bpsStep(0.5, 1, 0.2);
    expect(step.tau).toBeCloseTo(eventTime(0.5, 0.2), 12);
    expect(step.newX).toBeCloseTo(0.5 + step.tau, 12);
    expect(step.newV).toBe(-1);
    expect(Math.abs(step.newV)).toBe(1);
  });

  it("produces a deterministic finite trajectory of the requested length", () => {
    const a = bpsTrajectory(50, 0.5, 1, 31);
    const b = bpsTrajectory(50, 0.5, 1, 31);
    expect(a).toEqual(b);
    expect(a).toHaveLength(50);
    expect(a.every((s) => Number.isFinite(s.x) && s.tau > 0)).toBe(true);
    expect(a.every((s) => s.v === 1 || s.v === -1)).toBe(true);
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
