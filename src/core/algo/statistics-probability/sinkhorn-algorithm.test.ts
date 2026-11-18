/**
 * sinkhorn-algorithm.test.ts - Reference iteration and doubly stochastic checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./sinkhorn-algorithm";
import type { VisualFrame } from "@/types";

function reference(A: number[][], iterations: number): number[][] {
  const m = A.map((row) => [...row]);
  const rows = m.length;
  const cols = rows > 0 ? m[0]!.length : 0;
  for (let r = 0; r < iterations; r += 1) {
    for (let i = 0; i < rows; i += 1) {
      const sum = m[i]!.reduce((a, b) => a + b, 0);
      if (sum > 0) for (let j = 0; j < cols; j += 1) m[i]![j] = m[i]![j]! / sum;
    }
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;
      for (let i = 0; i < rows; i += 1) sum += m[i]![j]!;
      if (sum > 0) for (let i = 0; i < rows; i += 1) m[i]![j] = m[i]![j]! / sum;
    }
  }
  return m;
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number, iterations: number): void {
  expect(frames.length).toBe(1 + iterations * (rows + cols) + 1);
  frames.forEach((frame, index) => {
    expect(frame.stepNumber).toBe(index);
    expect(frame.layout).toBe("grid");
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.entities.length).toBe(rows * cols);
    expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
    expect(frame.entities.every((e) => (e.metadata.row as number) >= 0 && (e.metadata.col as number) >= 0)).toBe(true);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    expect(frame.meta).toBeDefined();
  });
}

describe("Sinkhorn algorithm", () => {
  const A = [
    [4, 1, 2],
    [1, 8, 1],
    [2, 1, 4],
  ];

  it("matches an independent scaling iteration exactly", () => {
    const iterations = 12;
    const frames = [...mod.run({ matrix: A, iterations })];
    checkFrames(frames, 3, 3, iterations);
    const expected = reference(A, iterations);
    const flat = frames[frames.length - 1]?.meta["matrix"] as number[];
    expect(flat.length).toBe(9);
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        expect(flat[i * 3 + j]).toBeCloseTo(expected[i]![j]!, 12);
      }
    }
  });

  it("drives row and column sums to one", () => {
    const frames = [...mod.run({ matrix: A, iterations: 60 })];
    const meta = frames[frames.length - 1]?.meta;
    expect(meta?.["maxRowError"] as number).toBeLessThan(1e-3);
    expect(meta?.["maxColError"] as number).toBeLessThan(1e-3);
  });

  it("reduces row error as rounds increase for a 3x3 matrix", () => {
    const input = A;
    const early = [...mod.run({ matrix: input, iterations: 1 })];
    const late = [...mod.run({ matrix: input, iterations: 40 })];
    const earlyMeta = early[early.length - 1]?.meta;
    const lateMeta = late[late.length - 1]?.meta;
    expect(lateMeta?.["maxRowError"] as number).toBeLessThan(earlyMeta?.["maxRowError"] as number);
    expect(lateMeta?.["maxRowError"] as number).toBeLessThan(1e-6);
    expect(lateMeta?.["maxColError"] as number).toBeLessThan(1e-6);
  });

  it("keeps nonnegative entries even with zero rows", () => {
    const frames = [...mod.run({ matrix: [[0, 0], [2, 6]], iterations: 4 })];
    const flat = frames[frames.length - 1]?.meta["matrix"] as number[];
    expect(flat.every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
  });

  it("terminates cleanly", () => {
    const generator = mod.run(mod.defaultInput);
    let count = 0;
    for (const _frame of generator) count += 1;
    expect(count).toBeGreaterThan(0);
    expect(generator.next().done).toBe(true);
  });
});
