/** concurrent-skip-list.test.ts - set correctness, lock/path properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./concurrent-skip-list";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

const sortedUnique = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);

describe("Concurrent Skip List", () => {
    it("contains every inserted key exactly once after all threads commit", () => {
        const input = mod.defaultInput as { initial: number[]; inserts: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalKeys = frames[frames.length - 1]?.meta["keys"] as number[];
        const expected = sortedUnique([...input.initial, ...input.inserts]);
        expect(finalKeys).toEqual(expected);
        for (const key of expected) expect(finalKeys.filter((k) => k === key)).toHaveLength(1);
        for (const absent of [-1, 5, 100]) expect(finalKeys).not.toContain(absent);
    });

    it("matches the expected key set for several inputs, including duplicate inserts", () => {
        const cases = [
            { initial: [2, 8], inserts: [5, 1, 12] },
            { initial: [], inserts: [3, 3, 7, 4] },
            { initial: [1, 4, 8, 16], inserts: [2, 6, 10, 14] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const finalKeys = frames[frames.length - 1]?.meta["keys"] as number[];
            expect(finalKeys).toEqual(sortedUnique([...input.initial, ...input.inserts]));
        }
    });

    it("keeps lanes sorted and unique in every frame and locks only predecessors", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const keys = frame.meta["keys"] as number[];
            expect(keys).toEqual(sortedUnique(keys));
            if (frame.meta["phase"] === "lock") {
                const value = frame.meta["value"] as number;
                const locked = frame.meta["lockedKeys"] as number[];
                for (const key of locked) expect(key).toBeLessThan(value);
            }
        }
        const splices = frames.filter((f) => f.meta["phase"] === "splice");
        for (const splice of splices) {
            const beforeIndex = frames.indexOf(splice) - 1;
            const before = frames[beforeIndex]?.meta["keys"] as number[];
            const after = splice.meta["keys"] as number[];
            expect(after.length - before.length).toBeLessThanOrEqual(1);
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
