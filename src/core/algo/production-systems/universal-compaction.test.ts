/** universal-compaction.test.ts - Independent scheduler, key preservation property, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./universal-compaction";
import type { VisualFrame } from "@/types";

type Levels = number[][][];

function reference(batches: number[][], threshold: number, maxLevel: number): { levels: Levels; merges: number } {
    const levels: Levels = Array.from({ length: maxLevel + 1 }, () => []);
    let merges = 0;
    for (const batch of batches) {
        (levels[0] ?? []).push([...batch].sort((a, b) => a - b));
        for (let level = 0; level < maxLevel; level += 1) {
            const runs = levels[level] ?? [];
            while (runs.length >= threshold) {
                const merged = runs.splice(0, runs.length).flat().sort((a, b) => a - b);
                (levels[level + 1] ?? []).push(merged);
                merges += 1;
            }
        }
    }
    return { levels, merges };
}

function checkFrames(frames: VisualFrame[], threshold: number, maxLevel: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe((maxLevel + 1) * threshold);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("UniversalCompaction", () => {
    it("matches an independent compaction scheduler", () => {
        const cases = [
            { batches: [[3, 1], [5, 2], [7, 4], [9, 6], [8, 0], [10, 11]], threshold: 3, maxLevel: 3 },
            { batches: [[1], [2], [3], [4], [5]], threshold: 2, maxLevel: 2 },
            { batches: [[9, 8, 7], [6, 5, 4], [3, 2, 1], [0]], threshold: 4, maxLevel: 2 },
        ];
        for (const input of cases) {
            const expected = reference(input.batches, input.threshold, input.maxLevel);
            const frames = [...mod.run(input)];
            checkFrames(frames, input.threshold, input.maxLevel);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["merges"]).toBe(expected.merges);
            expect(final?.["levels"]).toEqual(expected.levels);
        }
    });

    it("preserves every key, keeps runs sorted, and bounds level sizes", () => {
        let seed = 101;
        for (let trial = 0; trial < 20; trial += 1) {
            const threshold = 2 + (trial % 3);
            const maxLevel = 2 + (trial % 2);
            const batches: number[][] = [];
            for (let b = 0; b < 10; b += 1) {
                const batch: number[] = [];
                for (let k = 0; k < 3; k += 1) {
                    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                    batch.push(seed % 50);
                }
                batches.push(batch);
            }
            const frames = [...mod.run({ batches, threshold, maxLevel })];
            checkFrames(frames, threshold, maxLevel);
            const levels = frames[frames.length - 1]?.meta["levels"] as Levels;
            for (let level = 0; level < levels.length; level += 1) {
                const runs = levels[level] ?? [];
                if (level < maxLevel) {
                    expect(runs.length).toBeLessThan(threshold);
                }
                for (const run of runs) {
                    expect([...run].sort((a, b) => a - b)).toEqual(run);
                }
            }
            const stored = (frames[frames.length - 1]?.meta["keys"] as number[]) ?? [];
            expect(stored).toEqual(batches.flat().sort((a, b) => a - b));
            expect([...mod.run({ batches, threshold, maxLevel })]).toEqual(frames);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
