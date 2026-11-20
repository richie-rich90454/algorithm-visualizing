/**
 * quantum-ordered-search.test.ts - Independent index cross-check, iteration
 * formula, absence handling, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-ordered-search";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Quantum Ordered Search", () => {
    it("returns the index an independent scan finds", () => {
        const values = [2, 4, 6, 8, 10, 12, 14, 16, 18];
        for (const target of values) {
            const frames = [...mod.run({ values, target })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!.meta;
            expect(last["found"]).toBe(true);
            expect(last["index"]).toBe(values.indexOf(target));
            expect(last["value"]).toBe(target);
        }
    });

    it("reports absence for a missing target", () => {
        const frames = [...mod.run({ values: [2, 4, 6, 8], target: 5 })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["found"]).toBe(false);
        expect(last["marked"]).toBe(0);
    });

    it("computes the Grover count from the list length", () => {
        const values = Array.from({ length: 16 }, (_, i) => i);
        const frames = [...mod.run({ values, target: 9 })];
        checkFrames(frames);
        const expected = Math.floor(Math.PI / (4 * Math.sqrt(1 / 16)) - 0.5);
        const amp = frames[2]!.meta;
        expect(amp["iterations"]).toBe(expected);
        const probability = Number(amp["probability"]);
        expect(probability).toBeGreaterThan(0);
        expect(probability).toBeLessThanOrEqual(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
