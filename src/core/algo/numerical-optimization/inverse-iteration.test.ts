/**
 * inverse-iteration.test.ts - Closed-form eigenpair checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { inverseIteration } from "./inverse-iteration";
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
    });
}

/** Eigenvalues of a symmetric 2 by 2 matrix in closed form. */
function eigenvalues2x2(a: number[][]): number[] {
    const [p, q] = [a[0]![0]!, a[1]![1]!];
    const b = a[0]![1]!;
    const mid = (p + q) / 2;
    const gap = Math.sqrt(((p - q) / 2) ** 2 + b * b);
    return [mid + gap, mid - gap];
}

describe("Inverse Iteration", () => {
    it("converges to the eigenvalue nearest the shift for a symmetric matrix", () => {
        const a = [[2, 1], [1, 2]];
        const [high, low] = eigenvalues2x2(a);
        const cases = [
            { shift: high! + 0.2, expected: high! },
            { shift: low! - 0.2, expected: low! },
            { shift: 3.2, expected: high! },
            { shift: 0.8, expected: low! },
        ];
        for (const { shift, expected } of cases) {
            const data = inverseIteration(a, shift, 20, [1, 0.7]);
            const final = data.history[data.history.length - 1]!;
            expect(final.eigenvalue).toBeCloseTo(expected, 8);
            expect(final.residual).toBeLessThan(1e-8);
            const norm = Math.sqrt(final.vector.reduce((s, v) => s + v * v, 0));
            expect(norm).toBeCloseTo(1, 10);
            // The vector really is an eigenvector of A.
            const av = [
                a[0]![0]! * final.vector[0]! + a[0]![1]! * final.vector[1]!,
                a[1]![0]! * final.vector[0]! + a[1]![1]! * final.vector[1]!,
            ];
            for (let i = 0; i < 2; i += 1) {
                expect(av[i]).toBeCloseTo(expected * final.vector[i]!, 7);
            }
        }
    });

    it("handles a diagonal matrix with distinct eigenvalues", () => {
        const a = [[5, 0, 0], [0, -2, 0], [0, 0, 9]];
        const data = inverseIteration(a, 8.7, 15, [1, 1, 1]);
        const final = data.history[data.history.length - 1]!;
        expect(final.eigenvalue).toBeCloseTo(9, 8);
        expect(final.residual).toBeLessThan(1e-8);
    });

    it("emits well-formed frames and terminates cleanly", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["eigenvalue"])).toBeCloseTo(3, 6);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
