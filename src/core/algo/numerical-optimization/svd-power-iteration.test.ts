/**
 * svd-power-iteration.test.ts - Exact 2x2 eigenvalue cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./svd-power-iteration";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent top eigenvalue of A^T A for a two by two matrix. */
function topEigenvalueOfNormal(a: number[][]): number {
    const p = (a[0]?.[0] ?? 0) * (a[0]?.[0] ?? 0) + (a[1]?.[0] ?? 0) * (a[1]?.[0] ?? 0);
    const q = (a[0]?.[0] ?? 0) * (a[0]?.[1] ?? 0) + (a[1]?.[0] ?? 0) * (a[1]?.[1] ?? 0);
    const r = (a[0]?.[1] ?? 0) * (a[0]?.[1] ?? 0) + (a[1]?.[1] ?? 0) * (a[1]?.[1] ?? 0);
    const trace = p + r;
    const det = p * r - q * q;
    return (trace + Math.sqrt(trace * trace - 4 * det)) / 2;
}

describe("SvdPowerIteration", () => {
    it("finds the dominant singular value on several matrices", () => {
        const matrices = [
            [[3, 1], [1, 2]],
            [[4, 0], [0, 2]],
            [[2, 1], [1, 3]],
        ];
        for (const a of matrices) {
            const frames = [...mod.run({ a, iterations: 200 })];
            checkFrames(frames, 2);
            const final = frames[frames.length - 1]?.meta;
            const expected = Math.sqrt(topEigenvalueOfNormal(a));
            expect(final?.["singularValue"]).toBeCloseTo(expected, 6);
            const vector = final?.["vector"] as number[];
            expect(Math.hypot(vector[0] ?? 0, vector[1] ?? 0)).toBeCloseTo(1, 10);
        }
    });

    it("converges to an eigenvector of A^T A", () => {
        const frames = [...mod.run({ iterations: 200 })];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["eigenvalueResidual"]).toBeLessThan(1e-8);
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
