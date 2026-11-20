/** b-plus-tree-insert.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./b-plus-tree-insert";
import type { VisualFrame } from "@/types";

type NumArray = number[];

/** Check that a frame sequence is well formed and that the generator terminates. */
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
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

describe("B+ Tree Insertion", () => {
    it("stores exactly the sorted distinct keys after every insert", () => {
        const keys = [10, 20, 5, 6, 12, 30, 7, 17, 3, 4, 2, 40, 1];
        const frames = [...mod.run({ keys, order: 4 })];
        checkFrames(frames);
        expect(frames.length).toBe(keys.length + 2);
        for (let i = 0; i < keys.length; i += 1) {
            const frame = frames[i + 1];
            const expected = [...new Set(keys.slice(0, i + 1))].sort((a, b) => a - b);
            expect(frame?.meta["leafKeys"]).toEqual(expected);
            expect(frame?.meta["valid"]).toBe(true);
            const depths = frame?.meta["leafDepths"] as NumArray | undefined;
            expect(new Set(depths).size).toBe(1);
        }
    });

    it("keeps every leaf at one depth for several orders and random keys", () => {
        let seed = 12345;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 1000;
        };
        for (const order of [3, 4, 5, 6]) {
            const keys = Array.from({ length: 60 }, () => next());
            const frames = [...mod.run({ keys, order })];
            const final = frames[frames.length - 1];
            expect(final?.meta["valid"]).toBe(true);
            expect(final?.meta["leafKeys"]).toEqual([...new Set(keys)].sort((a, b) => a - b));
            const depths = final?.meta["leafDepths"] as NumArray | undefined;
            expect(new Set(depths).size).toBe(1);
            expect(depths?.[0]).toBeGreaterThanOrEqual(0);
        }
    });

    it("handles duplicates and an empty input without corrupting the tree", () => {
        const frames = [...mod.run({ keys: [5, 5, 5, 5], order: 3 })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["leafKeys"]).toEqual([5]);
        expect(final?.meta["valid"]).toBe(true);
        const empty = [...mod.run({ keys: [], order: 3 })];
        checkFrames(empty);
        expect(empty[0]?.meta["leafKeys"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
