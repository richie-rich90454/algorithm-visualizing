/** mapreduce-combiner.test.ts - Combiner correctness, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./mapreduce-combiner";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], splits: number): void {
    expect(frames.length).toBe(1 + splits * 2 + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((e) => expect(e.type).toBe("cell"));
    });
}

function bruteForceCounts(documents: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
        for (const raw of doc.toLowerCase().split(/\s+/)) {
            if (raw.length > 0) counts[raw] = (counts[raw] ?? 0) + 1;
        }
    }
    return counts;
}

describe("MapReduce combiner", () => {
    it("produces the same counts as a direct reduce on random documents", () => {
        const cases: string[][] = [
            ["a b a", "b c c", "a a a"],
            ["x", "y y", "z z z z"],
            ["the quick brown fox", "the slow dog", "fox and dog"],
            ["", "a", "a a a a"],
        ];
        for (const documents of cases) {
            const frames = [...mod.run({ documents })];
            checkFrames(frames, documents.length);
            const final = frames[frames.length - 1]!.meta;
            expect(final["matches"]).toBe(true);
            expect(final["finalCounts"]).toEqual(bruteForceCounts(documents));
            expect(final["combinedCounts"]).toEqual(bruteForceCounts(documents));
        }
    });

    it("collapses records without losing keys", () => {
        const frames = [...mod.run({ documents: ["a a a a a", "b b b"] })];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]!.meta;
        expect(final["finalCounts"]).toEqual({ a: 5, b: 3 });
        const combinedFrames = frames.slice(1 + 2, -1);
        expect(combinedFrames[0]!.meta["localCounts"]).toEqual({ a: 5 });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
