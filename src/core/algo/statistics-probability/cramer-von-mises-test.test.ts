/** cramer-von-mises-test.test.ts - brute-force W-squared, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./cramer-von-mises-test";
import type { VisualFrame } from "@/types";

function referenceW2(data: number[], a: number, b: number): number {
    const sorted = [...data].sort((x, y) => x - y);
    const n = sorted.length;
    let w2 = 1 / (12 * n);
    sorted.forEach((x, i) => {
        const f = Math.min(1, Math.max(0, (x - a) / (b - a)));
        w2 += (f - (2 * (i + 1) - 1) / (2 * n)) ** 2;
    });
    return w2;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * n);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Cramer-von Mises Test", () => {
    it("matches brute-force W-squared on several samples and ranges", () => {
        const cases: Array<{ data: number[]; a: number; b: number }> = [
            { data: [0.12, 0.45, 0.30, 0.78, 0.56, 0.91, 0.23, 0.67], a: 0, b: 1 },
            { data: [1, 2, 3, 4, 5, 6, 7, 8], a: 0, b: 9 },
            { data: [0.5, 0.5, 0.5, 0.5], a: 0, b: 1 },
            { data: [0.9, 0.1, 0.9, 0.1, 0.9, 0.1], a: 0, b: 1 },
        ];
        for (const { data, a, b } of cases) {
            const frames = [...mod.run({ data, a, b })];
            checkFrames(frames, data.length);
            const final = frames.at(-1)?.meta;
            expect(Number(final?.["a"])).toBeCloseTo(a, 9);
            expect(Number(final?.["b"])).toBeCloseTo(b, 9);
            expect(Number(final?.["w2"])).toBeCloseTo(referenceW2(data, a, b), 9);
        }
    });

    it("is bounded below by 1/(12n) and minimal for evenly spaced probability points", () => {
        const n = 8;
        const ideal = Array.from({ length: n }, (_, i) => (2 * (i + 1) - 1) / (2 * n));
        const idealW2 = Number([...mod.run({ data: ideal, a: 0, b: 1 })].at(-1)?.meta["w2"]);
        expect(idealW2).toBeCloseTo(1 / (12 * n), 9);
        const clustered = Number([...mod.run({ data: [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.09], a: 0, b: 1 })].at(-1)?.meta["w2"]);
        expect(clustered).toBeGreaterThan(idealW2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
