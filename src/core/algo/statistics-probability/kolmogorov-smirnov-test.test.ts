/**
 * kolmogorov-smirnov-test.test.ts - Brute-force D, distribution properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kolmogorov-smirnov-test";
import type { VisualFrame } from "@/types";

/** Independent KS statistic computed from the definition. */
function referenceD(sample: number[], a: number, b: number): number {
    const sorted = [...sample].sort((x, y) => x - y);
    const n = sorted.length;
    const cdf = (x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
    let dPlus = 0;
    let dMinus = 0;
    for (let i = 0; i < n; i += 1) {
        dPlus = Math.max(dPlus, (i + 1) / n - cdf(sorted[i] as number));
        dMinus = Math.max(dMinus, cdf(sorted[i] as number) - i / n);
    }
    return Math.max(dPlus, dMinus);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(4);
        expect(frame.meta["cols"]).toBe(n);
    });
}

describe("Kolmogorov-Smirnov Test", () => {
    it("matches an independent brute-force statistic", () => {
        const cases = [
            { sample: [0.11, 0.29, 0.33, 0.42, 0.55], a: 0, b: 1 },
            { sample: [0.9, 0.1, 0.5, 0.3], a: 0, b: 1 },
            { sample: [2, 4, 6, 8, 10, 12], a: 0, b: 10 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.sample.length);
            const final = frames[frames.length - 1];
            expect(Number(final?.meta["D"])).toBeCloseTo(referenceD(testCase.sample, testCase.a, testCase.b), 12);
            expect(Number(final?.meta["dPlus"])).toBeGreaterThanOrEqual(0);
            expect(Number(final?.meta["dMinus"])).toBeGreaterThanOrEqual(0);
        }
    });

    it("has a bounded, monotone p-value and a consistent critical value", () => {
        const uniform = Array.from({ length: 40 }, (_, i) => (i + 0.5) / 40);
        const good = [...mod.run({ sample: uniform, alpha: 0.05 })];
        const bad = [...mod.run({ sample: [0, 0, 0, 0, 0.01, 0.02], alpha: 0.05 })];
        const pGood = Number(good[good.length - 1]?.meta["pValue"]);
        const pBad = Number(bad[bad.length - 1]?.meta["pValue"]);
        expect(pGood).toBeGreaterThanOrEqual(0);
        expect(pGood).toBeLessThanOrEqual(1);
        expect(pBad).toBeLessThanOrEqual(1);
        expect(pBad).toBeLessThan(pGood);
        expect(bad[bad.length - 1]?.meta["significant"]).toBe(true);

        const critical = Number(good[good.length - 1]?.meta["critical"]);
        expect(critical).toBeGreaterThan(0);
        expect(critical).toBeLessThan(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
