/** coppersmith-small-roots.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./coppersmith-small-roots";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function modOf(value: number, n: number): number {
    return ((value % n) + n) % n;
}

describe("Coppersmith small roots", () => {
    it("finds roots that satisfy the modular equation within the bound", () => {
        const cases = [
            { n: 1009, a: 7, x: 25, planted: 17 },
            { n: 10007, a: 3, x: 20, planted: 7 },
            { n: 100003, a: 7, x: 25, planted: 13 },
            { n: 1009, a: 11, x: 40, planted: -24 },
        ];
        for (const testCase of cases) {
            const b = modOf(-testCase.planted * testCase.planted - testCase.a * testCase.planted, testCase.n);
            const frames = [...mod.run({ a: testCase.a, b, n: testCase.n, x: testCase.x })];
            checkFrames(frames);
            const root = frames[frames.length - 1]?.meta["root"] as number;
            expect(root).toBeGreaterThanOrEqual(-testCase.x);
            expect(root).toBeLessThanOrEqual(testCase.x);
            expect(modOf(root * root + testCase.a * root + b, testCase.n)).toBe(0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
