/** harmonic-mean.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./harmonic-mean";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent reference: n divided by the sum of reciprocals. */
function reference(values: number[]): number {
    return values.length / values.reduce((sum, v) => sum + 1 / v, 0);
}

describe("Harmonic Mean", () => {
    it("matches the reciprocal reference on several inputs", () => {
        const cases = [
            [1, 2, 4, 8],
            [1, 1, 1],
            [2, 6],
            [10, 20, 40, 80],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["valid"]).toBe(true);
            expect(Number(finalMeta?.["result"])).toBeCloseTo(reference(values), 9);
            expect(frames.length).toBe(values.length + 2);
        }
    });

    it("gives the known two-speed average for 1 and 2", () => {
        const frames = [...mod.run({ values: [1, 2] })];
        expect(Number(frames[frames.length - 1]?.meta["result"])).toBeCloseTo(4 / 3, 9);
    });

    it("never exceeds the arithmetic mean", () => {
        const values = [2, 5, 10, 20];
        const frames = [...mod.run({ values })];
        const harmonic = Number(frames[frames.length - 1]?.meta["result"]);
        const arithmetic = values.reduce((a, b) => a + b, 0) / values.length;
        expect(harmonic).toBeLessThanOrEqual(arithmetic + 1e-9);
    });

    it("reports an undefined result for empty or nonpositive input", () => {
        const empty = [...mod.run({ values: [] })];
        checkFrames(empty);
        expect(empty[empty.length - 1]?.meta["valid"]).toBe(false);
        const bad = [...mod.run({ values: [1, -2, 4] })];
        checkFrames(bad);
        expect(bad[bad.length - 1]?.meta["valid"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
