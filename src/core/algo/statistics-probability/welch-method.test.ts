/**
 * welch-method.test.ts - Independent transform and frame checks.
 */
import { describe, expect, it } from "vitest";
import mod, { hannWindow, periodogram, welchPsd } from "./welch-method";
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

describe("Welch method", () => {
  it("builds a Hann window that vanishes at both ends", () => {
    const w = hannWindow(16);
    expect(w).toHaveLength(16);
    expect(w[0]).toBeCloseTo(0, 12);
    expect(w.at(-1)).toBeCloseTo(0, 12);
    expect(w[7]).toBeCloseTo(w[8], 6);
  });

  it("locates a pure tone at its exact bin", () => {
    const n = 32;
    const k = 5;
    const signal = Array.from({ length: n }, (_, t) => Math.cos((2 * Math.PI * k * t) / n));
    const p = periodogram(signal);
    let peak = 0;
    for (let i = 1; i < p.length; i += 1) if ((p[i] as number) > (p[peak] as number)) peak = i;
    expect([k, n - k]).toContain(peak);
    expect(p[k] as number).toBeGreaterThan(100 * (p[2] as number));
    expect(p[k] as number).toBeCloseTo(p[n - k] as number, 6);
  });

  it("satisfies Parseval's relation for a segment", () => {
    const segment = [1, 2, 3, 4, 3, 2, 1, 0];
    const p = periodogram(segment);
    const energy = segment.reduce((sum, v) => sum + v * v, 0);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(energy, 8);
  });

  it("satisfies conjugate symmetry for real signals", () => {
    const result = welchPsd([1, 2, 1, -1, -2, -1, 0, 1, 2, 1, -1, -2, -1, 0, 1, 2], 8, 4);
    for (let k = 1; k < result.length; k += 1) {
      expect(result.psd[k]).toBeCloseTo(result.psd[result.length - k] as number, 8);
    }
  });

  it("averages exactly the segment periodograms", () => {
    const signal = Array.from({ length: 96 }, (_, i) => Math.sin(i / 3) + Math.cos(i / 5));
    const result = welchPsd(signal, 32, 16);
    expect(result.segments).toBeGreaterThan(1);
    for (let k = 0; k < 32; k += 1) {
      const mean = result.segmentPsd.reduce((sum, p) => sum + (p[k] as number), 0) / result.segments;
      expect(result.psd[k]).toBeCloseTo(mean, 10);
    }
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
