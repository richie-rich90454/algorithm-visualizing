/**
 * dancing-tree.test.ts - Correctness and frame checks for the dancing tree.
 */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./dancing-tree";

function drain(input: unknown): VisualFrame[] {
    const out: VisualFrame[] = [];
    for (const frame of mod.run(input)) out.push(frame);
    return out;
}

function checkShapes(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("tree");
        expect(frame.meta).toBeTypeOf("object");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("DancingTree", () => {
    it("emits well-formed frames with sequential steps", () => {
        checkShapes(drain(mod.defaultInput));
    });

    it("reports the same hits as a brute-force membership oracle", () => {
        const input = mod.defaultInput as { keys: number[]; queries: number[] };
        const frames = drain(input);
        const expected = input.queries.map((q) => (input.keys.includes(q) ? 1 : 0));
        expect(frames[frames.length - 1]?.meta.results).toEqual(expected);
    });

    it("preserves the sorted in-order sequence and lifts the last hit to the root", () => {
        const input = mod.defaultInput as { keys: number[]; queries: number[] };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        const sorted = [...new Set(input.keys)].sort((a, b) => a - b);
        expect(final?.meta.inOrder).toEqual(sorted);
        const lastFound = [...input.queries].reverse().find((q) => input.keys.includes(q));
        expect(final?.meta.rootKey).toBe(lastFound);
    });

    it("keeps the in-order sequence valid on a second input", () => {
        const input = { keys: [10, 20, 30, 40, 50], queries: [30, 99, 10] };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        expect(final?.meta.inOrder).toEqual([10, 20, 30, 40, 50]);
        expect(final?.meta.results).toEqual([1, 0, 1]);
        expect(final?.meta.rootKey).toBe(10);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _ of gen) count += 1;
        expect(count).toBeGreaterThan(3);
        expect(gen.next().done).toBe(true);
    });
});
