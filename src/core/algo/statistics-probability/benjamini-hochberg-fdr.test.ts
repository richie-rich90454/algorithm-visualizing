/**
 * benjamini-hochberg-fdr.test.ts - Brute-force BH reference and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./benjamini-hochberg-fdr";
import type { VisualFrame } from "@/types";

function referenceBH(ps: number[], q: number) {
  const m = ps.length;
  const sorted = ps
    .map((p, i) => ({ p, i }))
    .sort((a, b) => a.p - b.p || a.i - b.i);
  let largest = 0;
  for (let k = 1; k <= m; k += 1) {
    if (sorted[k - 1]!.p <= (k / m) * q) largest = k;
  }
  const threshold = largest > 0 ? sorted[largest - 1]!.p : 0;
  const rejected = largest > 0 ? sorted.slice(0, largest).map((e) => e.i).sort((a, b) => a - b) : [];
  return { largest, threshold, rejected };
}

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

function checkFrames(frames: VisualFrame[], m: number): void {
  expect(frames.length).toBe(m + 2);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("array");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
  for (const frame of frames) {
    expect(frame.entities.length).toBe(m);
    expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
  }
}

describe("Benjamini-Hochberg FDR", () => {
  it("matches an independent BH implementation on random inputs", () => {
    const rng = makeRng(99);
    for (let trial = 0; trial < 60; trial += 1) {
      const m = 1 + (trial % 25);
      const ps = Array.from({ length: m }, () => rng());
      const q = rng();
      const frames = [...mod.run({ pValues: ps, q })];
      checkFrames(frames, m);
      const expected = referenceBH(ps, q);
      const meta = frames[frames.length - 1]?.meta;
      expect(meta?.["rejections"]).toBe(expected.largest);
      expect(meta?.["threshold"] as number).toBeCloseTo(expected.threshold, 12);
      expect(meta?.["rejected"] as number[]).toEqual(expected.rejected);
      expect((meta?.["rejected"] as number[]).length).toBe(expected.largest);
    }
  });

  it("rejects nothing at q=0 and when all p-values are one", () => {
    for (const input of [
      { pValues: [0.01, 0.2, 0.5], q: 0 },
      { pValues: [1, 1, 1, 1], q: 0.5 },
    ]) {
      const frames = [...mod.run(input)];
      const meta = frames[frames.length - 1]?.meta;
      expect(meta?.["rejections"]).toBe(0);
      expect(meta?.["rejected"] as number[]).toEqual([]);
    }
  });

  it("rejects every hypothesis when all p-values are tiny", () => {
    const ps = [0.0001, 0.0002, 0.0003, 0.0004];
    const frames = [...mod.run({ pValues: ps, q: 0.05 })];
    const meta = frames[frames.length - 1]?.meta;
    expect(meta?.["rejections"]).toBe(4);
    expect(meta?.["rejected"] as number[]).toEqual([0, 1, 2, 3]);
    expect(meta?.["threshold"]).toBe(0.0004);
  });

  it("handles an empty input without producing bars", () => {
    const frames = [...mod.run({ pValues: [], q: 0.1 })];
    expect(frames.length).toBe(1);
    expect(frames[0]?.entities.length).toBe(0);
    expect(frames[0]?.meta["rejections"]).toBe(0);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
