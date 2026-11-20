/** digital-search-tree.test.ts - Brute-force membership cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./digital-search-tree";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["parentId"] === "string")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(frame.edges.every((e) => ids.has(e.sourceId) && ids.has(e.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["count"]).toBeDefined();
    });
}

describe("Digital Search Tree", () => {
    it("stores every distinct key and answers searches like a brute-force set", () => {
        let seed = 41;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 64;
        };
        for (let t = 0; t < 20; t += 1) {
            const keys = Array.from({ length: 3 + (t % 7) }, () => rand());
            const distinct = new Set(keys);
            for (const query of [rand(), ...keys]) {
                const frames = [...mod.run({ keys, query })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["found"]).toBe(distinct.has(query));
                expect(final?.["count"]).toBe(distinct.size);
                const labels = frames[frames.length - 1]?.entities.map((e) => Number(e.label)) ?? [];
                expect(labels.slice().sort((a, b) => a - b)).toEqual([...distinct].sort((a, b) => a - b));
            }
        }
    });

    it("handles an empty input and duplicate keys", () => {
        const empty = [...mod.run({ keys: [], query: 3 })];
        expect(empty[empty.length - 1]?.meta["found"]).toBe(false);
        const duplicate = [...mod.run({ keys: [4, 4, 4], query: 4 })];
        expect(duplicate[duplicate.length - 1]?.meta["count"]).toBe(1);
        expect(duplicate[duplicate.length - 1]?.meta["found"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
