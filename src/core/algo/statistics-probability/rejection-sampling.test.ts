/**
 * rejection-sampling.test.ts - Independent sampler replication and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./rejection-sampling";
import type { VisualFrame } from "@/types";

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function reference(exponent: number, wanted: number, seed: number, maxTrials: number) {
  const rng = makeRng(seed);
  const accepted: number[] = [];
  const trialsLog: Array<{ x: number; u: number; keep: boolean }> = [];
  let trials = 0;
  while (accepted.length < wanted && trials < maxTrials) {
    const x = rng();
    const u = rng();
    trials += 1;
    const keep = u <= Math.pow(x, exponent);
    trialsLog.push({ x, u, keep });
    if (keep) accepted.push(x);
  }
  return { accepted, trials, trialsLog };
}

function checkFrames(frames: VisualFrame[]): void {
  expect(frames.length).toBeGreaterThan(1);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("array");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Rejection sampling", () => {
  const input = { exponent: 1, samples: 400, bins: 12, seed: 7, maxTrials: 100000 };

  it("replicates an independent reference sampler exactly", () => {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    const ref = reference(input.exponent, input.samples, input.seed, input.maxTrials);
    const meta = frames[frames.length - 1]?.meta;
    expect(meta?.["trials"]).toBe(ref.trials);
    expect(meta?.["accepted"]).toBe(ref.accepted.length);
    expect(meta?.["acceptanceRate"] as number).toBeCloseTo(ref.accepted.length / ref.trials, 12);
    const first = meta?.["firstSamples"] as number[];
    expect(first.length).toBe(12);
    for (let i = 0; i < first.length; i += 1) {
      expect(first[i]).toBeCloseTo(ref.accepted[i] as number, 12);
    }
    for (let i = 0; i < ref.trialsLog.length && i < 16; i += 1) {
      const frame = frames[1 + i];
      const logged = ref.trialsLog[i] as { x: number; u: number; keep: boolean };
      expect(frame?.meta["x"] as number).toBeCloseTo(logged.x, 12);
      expect(frame?.meta["threshold"] as number).toBeCloseTo(logged.u, 12);
      expect(frame?.meta["accepted"]).toBe(logged.keep);
      expect(frame?.entities.some((e) => e.state === (logged.keep ? "sorted" : "error"))).toBe(true);
    }
  });

  it("recovers the theoretical mean and acceptance rate", () => {
    for (const exponent of [0, 1, 2, 3]) {
      const frames = [...mod.run({ ...input, exponent, samples: 2000, seed: exponent + 11 })];
      const meta = frames[frames.length - 1]?.meta;
      const expected = (exponent + 1) / (exponent + 2);
      expect(Math.abs((meta?.["mean"] as number) - expected)).toBeLessThan(0.06);
      expect(Math.abs((meta?.["acceptanceRate"] as number) - 1 / (exponent + 1))).toBeLessThan(0.06);
      expect(meta?.["expectedMean"] as number).toBeCloseTo(expected, 12);
    }
  });

  it("keeps acceptance within the unit interval at every trial", () => {
    const frames = [...mod.run(input)];
    for (const frame of frames) {
      const threshold = frame.meta["threshold"] as number | undefined;
      if (threshold !== undefined) {
        expect(threshold).toBeGreaterThanOrEqual(0);
        expect(threshold).toBeLessThanOrEqual(1);
      }
    }
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
