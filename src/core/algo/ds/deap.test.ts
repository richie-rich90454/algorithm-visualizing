/**
 * deap.test.ts - Correctness and frame checks for the deap.
 */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./deap";

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

describe("Deap", () => {
    it("emits well-formed frames with sequential steps", () => {
        checkShapes(drain(mod.defaultInput));
    });

    it("extracts successive minima in sorted order", () => {
        const input = mod.defaultInput as { keys: number[]; mins: number; maxs: number };
        const frames = drain(input);
        const popped = frames[frames.length - 1]?.meta.poppedMin as number[];
        const sorted = [...input.keys].sort((a, b) => a - b);
        expect(popped).toEqual(sorted.slice(0, input.mins));
    });

    it("extracts successive maxima in reverse sorted order", () => {
        const input = mod.defaultInput as { keys: number[]; mins: number; maxs: number };
        const frames = drain(input);
        const popped = frames[frames.length - 1]?.meta.poppedMax as number[];
        const sorted = [...input.keys].sort((a, b) => b - a);
        expect(popped).toEqual(sorted.slice(0, input.maxs));
    });

    it("leaves exactly the keys that were not extracted", () => {
        const input = mod.defaultInput as { keys: number[]; mins: number; maxs: number };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        const sorted = [...input.keys].sort((a, b) => a - b);
        const expected = sorted.slice(input.mins, sorted.length - input.maxs);
        expect(final?.meta.remaining).toEqual(expected);
        expect(final?.meta.size).toBe(expected.length);
    });

    it("matches a full brute-force double-ended extraction on another input", () => {
        const input = { keys: [4, 8, 1, 9, 2, 7, 3, 6], mins: 3, maxs: 2 };
        const frames = drain(input);
        const final = frames[frames.length - 1];
        const sorted = [...input.keys].sort((a, b) => a - b);
        expect(final?.meta.poppedMin).toEqual(sorted.slice(0, 3));
        expect(final?.meta.poppedMax).toEqual([...sorted].reverse().slice(0, 2));
        expect(final?.meta.remaining).toEqual(sorted.slice(3, sorted.length - 2));
    });

    it("keeps both heap roots equal to the true extremes during the run", () => {
        const frames = drain(mod.defaultInput);
        const keys = (mod.defaultInput as { keys: number[] }).keys;
        for (const frame of frames.slice(1, 1 + keys.length)) {
            const size = frame.meta.size as number;
            if (size > 0) {
                const values = new Set(keys.slice(0, size));
                expect(values.has(frame.meta.min as number)).toBe(true);
                expect(values.has(frame.meta.max as number)).toBe(true);
            }
        }
    });

    it("terminates cleanly", () => {
        const input = mod.defaultInput as { keys: number[]; mins: number; maxs: number };
        const gen = mod.run(input);
        let count = 0;
        for (const _ of gen) count += 1;
        expect(count).toBe(1 + input.keys.length + input.mins + input.maxs + 1);
        expect(gen.next().done).toBe(true);
    });
});
