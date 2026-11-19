/**
 * minimum-weight-perfect-matching-decoder.test.ts - Independent bitmask-DP
 * matching cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./minimum-weight-perfect-matching-decoder";
import type { VisualFrame } from "@/types";

function dpMatchWeight(defects: Array<[number, number]>): number {
    const m = defects.length;
    const w = (i: number, j: number): number =>
        Math.abs(defects[i]![0] - defects[j]![0]) + Math.abs(defects[i]![1] - defects[j]![1]);
    const dp = new Array<number>(1 << m).fill(Infinity);
    dp[0] = 0;
    for (let mask = 1; mask < 1 << m; mask += 1) {
        if ((mask & (mask - 1)) === 0) continue;
        const i = 31 - Math.clz32(mask & -mask);
        for (let j = 0; j < m; j += 1) {
            if (j === i || !(mask & (1 << j))) continue;
            const rest = mask & ~(1 << i) & ~(1 << j);
            dp[mask] = Math.min(dp[mask]!, w(i, j) + dp[rest]!);
        }
    }
    return dp[(1 << m) - 1]!;
}

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("MinimumWeightPerfectMatchingDecoder", () => {
    it("matches an independent bitmask DP on several defect sets", () => {
        const cases: Array<Array<[number, number]>> = [
            [[0, 0], [0, 3], [4, 1], [4, 4]],
            [[0, 0], [2, 0], [0, 2], [5, 5]],
            [[1, 1], [1, 4], [4, 1], [4, 4], [7, 2], [7, 6]],
            [[0, 0], [1, 2], [3, 1], [5, 5], [2, 6], [8, 8]],
        ];
        for (const defects of cases) {
            const frames = [...mod.run({ defects })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]!.meta;
            expect(meta["totalWeight"]).toBe(dpMatchWeight(defects));
            const pairs = meta["pairs"] as number[];
            expect(new Set(pairs).size).toBe(defects.length);
            expect([...pairs].sort((a, b) => a - b)).toEqual(defects.map((_, i) => i));
        }
    });

    it("respects the distance limit", () => {
        const defects: Array<[number, number]> = [[0, 0], [0, 1], [9, 9], [9, 8]];
        const frames = [...mod.run({ defects, maxDistance: 2 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["totalWeight"]).toBe(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
