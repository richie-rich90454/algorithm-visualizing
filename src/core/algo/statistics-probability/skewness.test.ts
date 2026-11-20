/**
 * skewness.test.ts - Independent centered third-moment check, symmetry and
 * sign properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./skewness";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], values: number[]): void {
    expect(frames.length).toBe(values.length + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(values.length);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Reference Fisher-Pearson g1 from a separate two-pass computation. */
function reference(values: number[]): number {
    const n = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    let m2 = 0;
    let m3 = 0;
    for (const value of values) {
        const d = value - mean;
        m2 += d * d;
        m3 += d * d * d;
    }
    m2 /= n;
    m3 /= n;
    return m2 === 0 ? 0 : m3 / Math.pow(m2, 1.5);
}

describe("Skewness", () => {
    it("matches an independent central-moment computation", () => {
        const datasets = [
            [1, 2, 2, 3, 3, 4, 4, 5, 8],
            [1, 1, 1, 1, 9],
            [2, 3, 3, 4, 4, 4, 5, 6, 11],
            [-5, -2, 0, 1, 1, 3, 9],
        ];
        for (const values of datasets) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values);
            const final = frames[frames.length - 1];
            expect(Number(final.meta["g1"])).toBeCloseTo(reference(values), 10);
            expect(Number(final.meta["m2"])).toBeGreaterThanOrEqual(0);
        }
    });

    it("gives zero for symmetric data and flips sign under reflection", () => {
        const symmetric = [1, 2, 3, 4, 5, 6, 7];
        expect(Number([...mod.run({ values: symmetric })].at(-1)?.meta["g1"])).toBeCloseTo(0, 10);
        const skewed = [1, 1, 2, 2, 3, 9];
        const g1 = Number([...mod.run({ values: skewed })].at(-1)?.meta["g1"]);
        const reflected = skewed.map((v) => -v);
        const g1Reflected = Number([...mod.run({ values: reflected })].at(-1)?.meta["g1"]);
        expect(g1).toBeGreaterThan(0);
        expect(g1Reflected).toBeCloseTo(-g1, 10);
    });

    it("reports a larger magnitude for the bias-corrected value", () => {
        const values = [1, 2, 2, 3, 3, 4, 4, 5, 8];
        const final = [...mod.run({ values })].at(-1);
        const g1 = Number(final?.meta["g1"]);
        const adjusted = Number(final?.meta["g1Adjusted"]);
        expect(Math.abs(adjusted)).toBeGreaterThanOrEqual(Math.abs(g1));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
