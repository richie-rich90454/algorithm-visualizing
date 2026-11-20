/**
 * parallel-merge-sort.test.ts - Permutation/run invariants, independent final sort, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./parallel-merge-sort";
import type { VisualFrame } from "@/types";

function runsOf(frame: VisualFrame): Array<[number, number]> {
    const flat = frame.meta["runs"] as number[];
    const runs: Array<[number, number]> = [];
    for (let i = 0; i + 1 < flat.length; i += 2) runs.push([flat[i] ?? 0, flat[i + 1] ?? 0]);
    return runs;
}

function isSorted(a: number[]): boolean {
    for (let i = 1; i < a.length; i += 1) {
        if ((a[i - 1] ?? 0) > (a[i] ?? 0)) return false;
    }
    return true;
}

function checkFrames(frames: VisualFrame[], source: number[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(source.length);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const values = frame.meta["values"] as number[];
        expect(values.length).toBe(source.length);
        expect([...values].sort((a, b) => a - b)).toEqual([...source].sort((a, b) => a - b));
        const runs = runsOf(frame);
        let cursor = 0;
        for (const run of runs) {
            expect(run[0]).toBe(cursor);
            expect(run[1]).toBeGreaterThan(run[0]);
            if ((frame.codeLineNumber ?? -1) >= 3) {
                expect(isSorted(values.slice(run[0], run[1]))).toBe(true);
            }
            cursor = run[1];
        }
        expect(cursor).toBe(source.length);
    });
}

describe("ParallelMergeSort", () => {
    it("sorts like the reference and keeps every run sorted at every frame", () => {
        const arrays: number[][] = [
            [38, 27, 43, 3, 9, 82, 10, 19, 51, 4],
            [5, 5, 5, 5],
            [-3, 7, -3, 0, 12, -8],
            [1],
            [],
            [9, 8, 7, 6, 5, 4, 3, 2, 1],
        ];
        let seed = 12345;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed % 200) - 100;
        };
        for (let i = 0; i < 8; i += 1) {
            arrays.push(Array.from({ length: 3 + i }, () => rand()));
        }
        for (const array of arrays) {
            for (const workers of [1, 2, 4, 16]) {
                const frames = [...mod.run({ array, workers })];
                checkFrames(frames, array);
                const final = frames[frames.length - 1]?.meta["values"] as number[];
                expect(final).toEqual([...array].sort((a, b) => a - b));
                if (array.length > 0) {
                    expect(runsOf(frames[frames.length - 1]!)).toEqual([[0, array.length]]);
                }
            }
        }
    });

    it("each merge frame's active run equals the run it just combined", () => {
        const frames = [...mod.run({ array: [8, 3, 5, 1, 9, 2, 7, 4], workers: 4 })];
        checkFrames(frames, [8, 3, 5, 1, 9, 2, 7, 4]);
        const mergeFrames = frames.filter((frame) => frame.codeLineNumber === 3);
        expect(mergeFrames.length).toBeGreaterThan(0);
        for (const frame of mergeFrames) {
            const runs = runsOf(frame);
            const highlighted = frame.entities
                .filter((entity) => entity.state === "comparing")
                .map((entity) => entity.metadata["index"] as number)
                .sort((a, b) => a - b);
            expect(highlighted.length).toBeGreaterThan(0);
            expect(
                runs.some(
                    (run) =>
                        highlighted.length === run[1] - run[0] &&
                        highlighted[0] === run[0] &&
                        highlighted[highlighted.length - 1] === run[1] - 1,
                ),
            ).toBe(true);
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
