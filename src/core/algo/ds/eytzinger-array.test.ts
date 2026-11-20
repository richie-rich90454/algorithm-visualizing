/**
 * eytzinger-array.test.ts - Correctness and frame checks for the Eytzinger array.
 */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./eytzinger-array";

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

describe("EytzingerArray", () => {
    it("emits well-formed frames with sequential steps", () => {
        checkShapes(drain(mod.defaultInput));
    });

    it("builds a level-order array that is a permutation of the sorted keys", () => {
        const input = mod.defaultInput as { keys: number[] };
        const frames = drain(input);
        const layout = frames[0]?.meta.layout as number[];
        expect(layout[0]).toBe(0);
        expect(layout.slice(1).sort((a, b) => a - b)).toEqual([...input.keys].sort((a, b) => a - b));
    });

    it("matches brute-force membership for every query", () => {
        const input = mod.defaultInput as { keys: number[]; queries: number[] };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        const expected = input.queries.map((q) => (input.keys.includes(q) ? 1 : 0));
        expect(final?.meta.hits).toEqual(expected);
    });

    it("returns a valid index only for keys that are present", () => {
        const input = { keys: [2, 4, 6, 8, 10, 12, 14], queries: [2, 7, 14, 100] };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        const hits = final?.meta.hits as number[];
        const positions = final?.meta.positions as number[];
        const layout = final?.meta.layout as number[];
        hits.forEach((hit, i) => {
            const pos = positions[i] ?? -1;
            if (hit === 1) expect(layout[pos]).toBe(input.queries[i]);
            else expect(pos).toBe(-1);
        });
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _ of gen) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(gen.next().done).toBe(true);
    });
});
