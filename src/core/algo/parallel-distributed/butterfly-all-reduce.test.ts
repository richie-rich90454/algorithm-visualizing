/** butterfly-all-reduce.test.ts - Reduction correctness, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./butterfly-all-reduce";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], p: number, rounds: number): void {
    expect(frames.length).toBe(rounds + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(p);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const nodeIds = new Set(frame.entities.map((e) => e.id));
        frame.edges.forEach((edge) => {
            expect(nodeIds.has(edge.sourceId)).toBe(true);
            expect(nodeIds.has(edge.targetId)).toBe(true);
        });
    });
}

function bruteForceSum(values: number[][]): number[] {
    const m = values[0]?.length ?? 0;
    return Array.from({ length: m }, (_, col) => values.reduce((s, v) => s + (v[col] ?? 0), 0));
}

describe("Butterfly all-reduce", () => {
    it("gives every process the global sum on several power-of-two inputs", () => {
        const cases: number[][][] = [
            [[1, 2], [3, 4], [5, 6], [7, 8]],
            [[10], [20]],
            [[1, -2, 3], [4, 5, -6], [7, 8, 9], [-1, -1, -1], [2, 0, 4], [3, 3, 3], [5, 5, 5], [9, 9, 9]],
        ];
        for (const values of cases) {
            const rounds = Math.log2(values.length);
            const frames = [...mod.run({ values })];
            checkFrames(frames, values.length, rounds);
            const final = frames[frames.length - 1]!.meta;
            expect(final["converged"]).toBe(true);
            const expected = bruteForceSum(values);
            expect(final["expected"]).toEqual(expected);
            for (const acc of final["accumulators"] as number[][]) expect(acc).toEqual(expected);
        }
    });

    it("doubles the contributor count each round", () => {
        const frames = [...mod.run({ values: [[1], [2], [3], [4]] })];
        checkFrames(frames, 4, 2);
        expect((frames[1]!.meta["accumulators"] as number[][])[0]).toEqual([3]);
        expect((frames[2]!.meta["accumulators"] as number[][])[0]).toEqual([10]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
