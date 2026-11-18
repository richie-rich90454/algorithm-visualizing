/**
 * gelman-rubin-diagnostic.test.ts - Independent R-hat check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gelman-rubin-diagnostic";
import type { VisualFrame } from "@/types";

/** Independent textbook computation of the classic Gelman-Rubin statistic. */
function reference(chains: number[][]) {
    const m = chains.length;
    const n = chains[0]?.length ?? 0;
    const means = chains.map((c) => c.reduce((a, b) => a + b, 0) / c.length);
    const variances = chains.map((c) => {
        const mu = c.reduce((a, b) => a + b, 0) / c.length;
        return c.reduce((a, b) => a + (b - mu) ** 2, 0) / (c.length - 1);
    });
    const W = variances.reduce((a, b) => a + b, 0) / m;
    const overall = means.reduce((a, b) => a + b, 0) / m;
    const B = (n / (m - 1)) * means.reduce((a, mu) => a + (mu - overall) ** 2, 0);
    const varPlus = ((n - 1) / n) * W + B / n;
    return { W, B, varPlus, rHat: Math.sqrt(varPlus / W) };
}

function checkFrames(frames: VisualFrame[], chains: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(chains);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("GelmanRubinDiagnostic", () => {
    it("matches an independent R-hat computation", () => {
        const chains = (mod.defaultInput as { chains: number[][] }).chains;
        const frames = [...mod.run({ chains })];
        checkFrames(frames, chains.length);
        const expected = reference(chains);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["W"])).toBeCloseTo(expected.W, 10);
        expect(Number(final?.["B"])).toBeCloseTo(expected.B, 10);
        expect(Number(final?.["varPlus"])).toBeCloseTo(expected.varPlus, 10);
        expect(Number(final?.["rHat"])).toBeCloseTo(expected.rHat, 10);
    });

    it("reports near one for mixed chains and much larger for separated chains", () => {
        const mixed = [
            [1, 1.1, 0.9, 1, 1.2, 0.8, 1, 1.1, 0.95, 1.05],
            [1.05, 0.95, 1.1, 0.9, 1, 1.2, 0.85, 1.15, 1, 1],
            [0.95, 1.05, 1, 1.1, 0.9, 1, 1.2, 0.85, 1.05, 0.95],
        ];
        const separated = [
            [0, 0.1, -0.1, 0, 0.2, -0.2, 0, 0.1, -0.1, 0],
            [5, 5.1, 4.9, 5, 5.2, 4.8, 5, 5.1, 4.9, 5],
            [10, 10.1, 9.9, 10, 10.2, 9.8, 10, 10.1, 9.9, 10],
        ];
        const mixedR = Number([...mod.run({ chains: mixed })].pop()?.meta["rHat"]);
        const separatedR = Number([...mod.run({ chains: separated })].pop()?.meta["rHat"]);
        expect(mixedR).toBeLessThan(1.1);
        expect(separatedR).toBeGreaterThan(2);
        expect(separatedR).toBeGreaterThan(mixedR);
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
