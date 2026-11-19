/**
 * optimal-binary-search-tree.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./optimal-binary-search-tree";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["n"]).toBe(n);
    });
}

/** Exhaustive enumeration of every root choice for every key interval. */
function brute(p: number[], q: number[]): number {
    const n = p.length;
    if (n === 0) return 0;
    function solve(i: number, j: number): number {
        if (i > j) return q[i] ?? 0;
        let weight = 0;
        for (let t = i; t <= j; t += 1) weight += p[t] as number;
        for (let t = i; t <= j + 1; t += 1) weight += q[t] ?? 0;
        let best = Number.POSITIVE_INFINITY;
        for (let k = i; k <= j; k += 1) {
            best = Math.min(best, solve(i, k - 1) + solve(k + 1, j) + weight);
        }
        return best;
    }
    return solve(0, n - 1);
}

function bestCostOf(p: number[], q: number[]): number {
    const frames = [...mod.run({ p, q })];
    checkFrames(frames, p.length);
    const meta = frames[frames.length - 1]?.meta ?? {};
    return meta["bestCost"] as number;
}

describe("Optimal Binary Search Tree", () => {
    it("matches exhaustive enumeration on the default input", () => {
        const input = mod.defaultInput as { p: number[]; q: number[] };
        expect(bestCostOf(input.p, input.q)).toBeCloseTo(brute(input.p, input.q), 5);
    });

    it("matches exhaustive enumeration on varied probabilities", () => {
        const cases: Array<{ p: number[]; q: number[] }> = [
            { p: [0.5], q: [0.25, 0.25] },
            { p: [0.5, 0.1, 0.1], q: [0.1, 0.1, 0.1, 0.1] },
            { p: [0.05, 0.05, 0.05, 0.05], q: [0.2, 0.2, 0.2, 0.2, 0.2] },
            { p: [0.4, 0.3, 0.2, 0.1], q: [0.01, 0.02, 0.03, 0.04, 0.05] },
        ];
        for (const testCase of cases) {
            expect(bestCostOf(testCase.p, testCase.q)).toBeCloseTo(brute(testCase.p, testCase.q), 5);
        }
    });

    it("handles the empty key set", () => {
        const frames = [...mod.run({ p: [], q: [1] })];
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[frames.length - 1]?.meta["bestCost"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
