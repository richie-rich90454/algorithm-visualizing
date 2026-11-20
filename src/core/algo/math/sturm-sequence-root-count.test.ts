/**
 * sturm-sequence-root-count.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./sturm-sequence-root-count";
import type { VisualFrame } from "@/types";

/** Brute force root count: scan a fine grid for sign changes of f. */
function bruteForceRoots(coefficients: number[], a: number, b: number): number {
    const f = (x: number): number => coefficients.reduce((value, c) => value * x + c, 0);
    const steps = 20000;
    let count = 0;
    let previous = f(a + (b - a) / steps);
    for (let i = 2; i <= steps; i += 1) {
        const current = f(a + ((b - a) * i) / steps);
        if ((previous < 0 && current >= 0) || (previous > 0 && current <= 0) || current === 0) {
            count += 1;
        }
        previous = current;
    }
    return count;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(Number.isInteger(entity.metadata.row)).toBe(true);
            expect(Number.isInteger(entity.metadata.col)).toBe(true);
        }
    });
}

describe("Sturm Root Counting", () => {
    it("matches brute-force sign-change counting", () => {
        const cubic = [1, -6, 11, -6];
        const cases: Array<[number, number]> = [[0, 4], [0, 1.5], [1.5, 2.5], [2.5, 3.5], [3.5, 4]];
        for (const [a, b] of cases) {
            const frames = [...mod.run({ coefficients: cubic, a, b })];
            checkFrames(frames);
            const count = Number(frames[frames.length - 1]?.meta["count"]);
            expect(count).toBe(bruteForceRoots(cubic, a, b));
        }
    });

    it("handles a quadratic with irrational roots", () => {
        const quadratic = [1, 0, -2];
        const frames = [...mod.run({ coefficients: quadratic, a: 0, b: 2 })];
        expect(Number(frames[frames.length - 1]?.meta["count"])).toBe(1);
        const both = [...mod.run({ coefficients: quadratic, a: -2, b: 2 })];
        expect(Number(both[both.length - 1]?.meta["count"])).toBe(2);
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
