/**
 * chebyshev-inequality.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./chebyshev-inequality";
import type { VisualFrame } from "@/types";

/** Independent brute-force computation of Chebyshev quantities. */
function reference(data: number[], ks: number[]) {
    const n = data.length;
    const mean = data.reduce((s, x) => s + x, 0) / n;
    const std = Math.sqrt(data.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
    const empiricals = ks.map((k) => (std > 0 ? data.filter((x) => Math.abs(x - mean) >= k * std).length / n : 0));
    const bounds = ks.map((k) => 1 / (k * k));
    return { n, mean, std, empiricals, bounds };
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Chebyshev inequality", () => {
    it("matches a brute-force reference and never violates the bound", () => {
        const cases: Array<{ data: number[]; ks: number[] }> = [
            { data: [2, 3, 3, 4, 4, 5, 9, 1], ks: [1, 1.5, 2, 3] },
            { data: [5, 5, 5, 5, 5], ks: [0.5, 1, 2] },
            { data: [-10, 0, 0, 0, 10], ks: [1, 2, 5] },
            { data: [1, 2, 4, 8, 16, 32], ks: [0.8, 1.2, 2.5, 4] },
        ];
        for (const { data, ks } of cases) {
            const frames = [...mod.run({ data, ks })];
            checkFrames(frames, ks.length);
            const expected = reference(data, ks);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["mean"]).toBeCloseTo(expected.mean, 10);
            expect(finalMeta?.["std"]).toBeCloseTo(expected.std, 10);
            const gotEmpiricals = finalMeta?.["empiricals"] as number[];
            const gotBounds = finalMeta?.["bounds"] as number[];
            expect(gotEmpiricals).toHaveLength(ks.length);
            expect(gotBounds).toHaveLength(ks.length);
            for (let i = 0; i < ks.length; i += 1) {
                expect(gotEmpiricals[i]).toBeCloseTo(expected.empiricals[i], 10);
                expect(gotBounds[i]).toBeCloseTo(expected.bounds[i], 10);
                expect(expected.empiricals[i]).toBeLessThanOrEqual(expected.bounds[i] + 1e-12);
            }
            expect(finalMeta?.["violations"]).toBe(0);
        }
    });

    it("holds for a deterministic grid of thresholds on varied data", () => {
        const data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
        const ks = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
        const frames = [...mod.run({ data, ks })];
        checkFrames(frames, ks.length);
        const expected = reference(data, ks);
        for (let i = 0; i < ks.length; i += 1) {
            expect(expected.empiricals[i]).toBeLessThanOrEqual(expected.bounds[i] + 1e-12);
        }
        expect(frames[frames.length - 1]?.meta["violations"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
