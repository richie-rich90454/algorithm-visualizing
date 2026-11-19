/**
 * finger-search-tree.test.ts - Correctness and frame checks for finger search.
 */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./finger-search-tree";

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
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeTypeOf("object");
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const entity of frame.entities) {
            expect(entity.metadata).toHaveProperty("row");
            expect(entity.metadata).toHaveProperty("col");
        }
    });
}

describe("FingerSearchTree", () => {
    it("emits well-formed frames with sequential steps", () => {
        checkShapes(drain(mod.defaultInput));
    });

    it("matches brute-force indexOf for every query", () => {
        const input = mod.defaultInput as { keys: number[]; queries: number[] };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        const keys = [...new Set(input.keys)].sort((a, b) => a - b);
        expect(final?.meta.hits).toEqual(input.queries.map((q) => (keys.indexOf(q) >= 0 ? 1 : 0)));
        expect(final?.meta.positions).toEqual(input.queries.map((q) => keys.indexOf(q)));
    });

    it("handles queries at both extremes and absent values", () => {
        const input = { keys: [2, 4, 6, 8, 10, 12, 14], queries: [2, 14, 7, 100, -5] };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        expect(final?.meta.hits).toEqual([1, 1, 0, 0, 0]);
        expect(final?.meta.positions).toEqual([0, 6, -1, -1, -1]);
    });

    it("stays local: nearby queries probe fewer slots than far ones", () => {
        const keys = Array.from({ length: 64 }, (_, i) => i * 2);
        const nearFrames = drain({ keys, queries: [62] });
        const farFrames = drain({ keys, queries: [126] });
        const nearProbes = nearFrames.filter((f) => f.description.includes("galloping")).length;
        const farProbes = farFrames.filter((f) => f.description.includes("galloping")).length;
        expect(nearProbes).toBeLessThan(farProbes);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _ of gen) count += 1;
        expect(count).toBeGreaterThan((mod.defaultInput as { queries: number[] }).queries.length);
        expect(gen.next().done).toBe(true);
    });
});
