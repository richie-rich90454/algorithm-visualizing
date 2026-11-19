/**
 * kurtosis.test.ts - Independent fourth-moment check, invariance, light and
 * heavy tail properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kurtosis";
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

/** Reference excess kurtosis from a separate two-pass computation. */
function reference(values: number[]): number {
    const n = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    let m2 = 0;
    let m4 = 0;
    for (const value of values) {
        const d = value - mean;
        const d2 = d * d;
        m2 += d2;
        m4 += d2 * d2;
    }
    m2 /= n;
    m4 /= n;
    return m2 === 0 ? 0 : m4 / (m2 * m2) - 3;
}

describe("Kurtosis", () => {
    it("matches an independent central-moment computation", () => {
        const datasets = [
            [2, 3, 3, 4, 4, 4, 5, 5, 6, 10],
            [1, 2, 3, 4, 5, 6, 7],
            [0, 0, 0, 0, 0, 0, 10],
            [-3, -1, 0, 2, 8],
        ];
        for (const values of datasets) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values);
            const final = frames[frames.length - 1];
            expect(Number(final.meta["excess"])).toBeCloseTo(reference(values), 10);
            expect(Number(final.meta["m4"])).toBeGreaterThanOrEqual(0);
        }
    });

    it("is invariant to shifting and scaling", () => {
        const base = [1, 2, 2, 4, 7];
        const shifted = base.map((v) => v + 25);
        const scaled = base.map((v) => v * 3);
        const excess = (values: number[]) => Number([...mod.run({ values })].at(-1)?.meta["excess"]);
        expect(excess(shifted)).toBeCloseTo(excess(base), 10);
        expect(excess(scaled)).toBeCloseTo(excess(base), 10);
    });

    it("distinguishes light and heavy tails", () => {
        const uniform = [1, 2, 3, 4, 5, 6, 7, 8];
        const heavy = [5, 5, 5, 5, 5, 5, 5, 50];
        const uniformExcess = Number([...mod.run({ values: uniform })].at(-1)?.meta["excess"]);
        const heavyExcess = Number([...mod.run({ values: heavy })].at(-1)?.meta["excess"]);
        expect(uniformExcess).toBeLessThan(0);
        expect(heavyExcess).toBeGreaterThan(uniformExcess);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(12);
        expect(generator.next().done).toBe(true);
    });
});
