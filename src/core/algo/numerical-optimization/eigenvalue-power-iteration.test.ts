/**
 * eigenvalue-power-iteration.test.ts - Analytic eigenvalue cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./eigenvalue-power-iteration";
import type { VisualFrame } from "@/types";

/** Exact eigenvalues of a two by two symmetric matrix. */
function analyticEigenvalues(a: number, b: number, d: number): [number, number] {
    const trace = a + d;
    const discriminant = Math.sqrt((a - d) ** 2 + 4 * b * b);
    return [(trace + discriminant) / 2, (trace - discriminant) / 2];
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Power Iteration", () => {
    it("converges to the dominant eigenvalue of rotated diagonal matrices", () => {
        const angles = [0.1, 0.3, 0.7, 1.1, 1.5, 2.0, 2.7, -0.4, -1.0];
        for (const angle of angles) {
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const lambda1 = 5;
            const lambda2 = 1;
            const A = [
                [lambda1 * cos * cos + lambda2 * sin * sin, (lambda1 - lambda2) * sin * cos],
                [(lambda1 - lambda2) * sin * cos, lambda1 * sin * sin + lambda2 * cos * cos],
            ];
            const frames = [...mod.run({ A, iterations: 300, tolerance: 1e-11 })];
            checkFrames(frames, 2);
            const finalMeta = frames[frames.length - 1]!.meta;
            const exact = analyticEigenvalues(A[0]![0]!, A[0]![1]!, A[1]![1]!)[0];
            expect(Number(finalMeta["eigenvalue"])).toBeCloseTo(exact, 6);
            expect(Number(finalMeta["residual"])).toBeLessThan(1e-6);
            expect(finalMeta["converged"]).toBe(true);
            const vector = finalMeta["vector"] as number[];
            const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
            expect(norm).toBeCloseTo(1, 6);
        }
    });

    it("matches the analytic dominant eigenvalue on the default matrix", () => {
        const frames = [...mod.run({ A: [[2, 1], [1, 2]], iterations: 100 })];
        const finalMeta = frames[frames.length - 1]!.meta;
        expect(Number(finalMeta["eigenvalue"])).toBeCloseTo(3, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
