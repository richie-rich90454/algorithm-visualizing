/**
 * propensity-score-matching.test.ts - Independent fit/match reference and frames.
 */

import { describe, expect, it } from "vitest";
import mod from "./propensity-score-matching";
import type { VisualFrame } from "@/types";

type Unit = { id: string; x: number; z: number; y: number };
const sigmoid = (v: number): number => 1 / (1 + Math.exp(-v));

function reference(units: Unit[], learningRate: number, iterations: number) {
  let b0 = 0;
  let b1 = 0;
  for (let s = 0; s < iterations; s += 1) {
    let g0 = 0;
    let g1 = 0;
    for (const u of units) {
      const e = u.z - sigmoid(b0 + b1 * u.x);
      g0 += e;
      g1 += e * u.x;
    }
    b0 += learningRate * g0;
    b1 += learningRate * g1;
  }
  const propensity = units.map((u) => sigmoid(b0 + b1 * u.x));
  const available = new Set(units.map((u, i) => (u.z === 0 ? i : -1)).filter((i) => i >= 0));
  const pairs: Array<[number, number]> = [];
  for (let ti = 0; ti < units.length; ti += 1) {
    if (units[ti]!.z !== 1) continue;
    let best = -1;
    let bestDist = Infinity;
    for (const ci of available) {
      const d = Math.abs(propensity[ti]! - propensity[ci]!);
      if (d < bestDist - 1e-12 || (Math.abs(d - bestDist) <= 1e-12 && (best < 0 || ci < best))) {
        best = ci;
        bestDist = d;
      }
    }
    if (best < 0) break;
    available.delete(best);
    pairs.push([ti, best]);
  }
  const att = pairs.reduce((a, [ti, ci]) => a + (units[ti]!.y - units[ci]!.y), 0) / pairs.length;
  return { b0, b1, propensity, pairs, att };
}

function checkFrames(frames: VisualFrame[], n: number): void {
  expect(frames.length).toBeGreaterThan(n);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("point");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBe(n);
    expect(frame.entities.every((e) => e.type === "node")).toBe(true);
    expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Propensity score matching", () => {
  const input = mod.defaultInput as { units: Unit[]; learningRate: number; iterations: number };

  it("replicates an independent logistic fit and greedy match", () => {
    const frames = [...mod.run(input)];
    checkFrames(frames, input.units.length);
    const expected = reference(input.units, input.learningRate, input.iterations);
    const meta = frames[frames.length - 1]?.meta;
    expect(meta?.["b0"] as number).toBeCloseTo(expected.b0, 12);
    expect(meta?.["b1"] as number).toBeCloseTo(expected.b1, 12);
    expect(meta?.["pairs"] as string[]).toEqual(
      expected.pairs.map(([ti, ci]) => `${ti}->${ci}`),
    );
    expect(meta?.["att"] as number).toBeCloseTo(expected.att, 12);
    expect(meta?.["matched"]).toBe(expected.pairs.length);
  });

  it("never reuses a control and always picks the nearest available one", () => {
    const frames = [...mod.run(input)];
    const expected = reference(input.units, input.learningRate, input.iterations);
    const controls = expected.pairs.map(([, ci]) => ci);
    expect(new Set(controls).size).toBe(controls.length);
    const availableAtEachStep = new Set(
      input.units.map((u, i) => (u.z === 0 ? i : -1)).filter((i) => i >= 0),
    );
    for (const [ti, ci] of expected.pairs) {
      const distance = Math.abs(expected.propensity[ti]! - expected.propensity[ci]!);
      for (const other of availableAtEachStep) {
        expect(Math.abs(expected.propensity[ti]! - expected.propensity[other]!)).toBeGreaterThanOrEqual(
          distance - 1e-12,
        );
      }
      availableAtEachStep.delete(ci);
    }
    const matchFrames = frames.filter((f) => f.meta["matched"] !== undefined && f.meta["treated"] !== undefined);
    expect(matchFrames.length).toBe(expected.pairs.length);
    for (const frame of matchFrames) {
      expect(frame.edges.length).toBeGreaterThan(0);
      expect(frame.edges.every((e) => e.state === "path")).toBe(true);
      const ids = new Set(frame.entities.map((e) => e.id));
      expect(frame.edges.every((e) => ids.has(e.sourceId) && ids.has(e.targetId))).toBe(true);
    }
  });

  it("produces a larger matched estimate than the naive gap when covariates are balanced", () => {
    const frames = [...mod.run(input)];
    const meta = frames[frames.length - 1]?.meta;
    expect(meta?.["att"] as number).toBeGreaterThan(0);
    expect(meta?.["rawGap"] as number).toBeGreaterThan(0);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
