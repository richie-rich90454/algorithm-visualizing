/**
 * rayleigh-quotient-iteration.test.ts - Closed-form eigenvalue reference,
 * eigenpair residual, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./rayleigh-quotient-iteration";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Closed-form eigenvalues of a two by two symmetric matrix. */
function eigenvalues(a: number[][]): number[] {
    const p = a[0]![0]!;
    const q = a[0]![1]!;
    const s = a[1]![1]!;
    const half = (p + s) / 2;
    const gap = Math.sqrt(((p - s) / 2) ** 2 + q * q);
    return [half - gap, half + gap];
}

describe("RayleighQuotientIteration", () => {
    it("converges to a true eigenvalue on several symmetric matrices", () => {
        const matrices: number[][][] = [
            [[2, 1], [1, 3]],
            [[5, 1], [1, 4]],
            [[3, 0.5], [0.5, 2]],
        ];
        for (const a of matrices) {
            for (const x0 of [[1, 0], [1, 1], [0, 1]]) {
                const frames = [...mod.run({ a, x0, maxIter: 30, tol: 1e-13 })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                const quotient = Number(final?.["quotient"]);
                const expected = eigenvalues(a);
                const distance = Math.min(
                    Math.abs(quotient - expected[0]!),
                    Math.abs(quotient - expected[1]!),
                );
                expect(distance).toBeLessThan(1e-8);
                expect(Number(final?.["residual"])).toBeLessThan(1e-8);
                expect(final?.["converged"]).toBe(true);
            }
        }
    });

    it("keeps the iterate normalized and reports the matching residual", () => {
        const input = mod.defaultInput as { a: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        for (const frame of frames) {
            const vector = frame.meta["eigenvector"] as number[];
            const norm = Math.hypot(vector[0]!, vector[1]!);
            expect(norm).toBeCloseTo(1, 10);

            const quotient = Number(frame.meta["quotient"]);
            const ax = [
                input.a[0]![0]! * vector[0]! + input.a[0]![1]! * vector[1]!,
                input.a[1]![0]! * vector[0]! + input.a[1]![1]! * vector[1]!,
            ];
            const recomputed = Math.hypot(
                ax[0]! - quotient * vector[0]!,
                ax[1]! - quotient * vector[1]!,
            );
            expect(Number(frame.meta["residual"])).toBeCloseTo(recomputed, 8);
        }
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
