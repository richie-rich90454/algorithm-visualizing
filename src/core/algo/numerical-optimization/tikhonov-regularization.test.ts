/**
 * tikhonov-regularization.test.ts - Optimality condition, shrinkage, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { objectiveValue, residualNorm, solveLinear, tikhonov } from "./tikhonov-regularization";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["cols"]).toBe(n);
    });
}

describe("Tikhonov regularization", () => {
    it("solveLinear matches a known solution", () => {
        const x = solveLinear([[2, 1], [1, 3]], [5, 10]);
        expect(x[0]).toBeCloseTo(1, 10);
        expect(x[1]).toBeCloseTo(3, 10);
    });

    it("lambda zero gives the ordinary least-squares solution", () => {
        const matrix = [[1, 1], [1, 2], [1, 3]];
        const b = [1, 2, 2];
        const x = tikhonov(matrix, b, 0);
        const reference = solveLinear(
            [[3, 6], [6, 14]],
            [5, 11],
        );
        x.forEach((value, index) => expect(value).toBeCloseTo(reference[index] as number, 8));
    });

    it("the solution satisfies the gradient optimality condition", () => {
        const matrix = [[1, 2], [3, 4], [5, 6]];
        const b = [1, 0, 2];
        const lambda = 0.5;
        const x = tikhonov(matrix, b, lambda);
        const n = x.length;
        for (let j = 0; j < n; j += 1) {
            let gradient = lambda * (x[j] as number);
            for (let i = 0; i < matrix.length; i += 1) {
                let dot = 0;
                for (let k = 0; k < n; k += 1) {
                    dot += (matrix[i]?.[k] as number) * (x[k] as number);
                }
                gradient += (matrix[i]?.[j] as number) * (dot - (b[i] ?? 0));
            }
            expect(gradient).toBeCloseTo(0, 8);
        }
    });

    it("larger lambda shrinks the coefficient norm and never worsens the penalized objective", () => {
        const matrix = [[1, 1], [1, 1.0001], [1, 0.9999]];
        const b = [2, 2.0001, 1.9999];
        let previousNorm = Infinity;
        for (const lambda of [0, 0.001, 0.01, 0.1, 1, 10]) {
            const x = tikhonov(matrix, b, lambda);
            const norm = Math.sqrt(x.reduce((sum, value) => sum + value * value, 0));
            expect(norm).toBeLessThanOrEqual(previousNorm + 1e-9);
            const atZero = objectiveValue(matrix, b, [0, 0], lambda);
            expect(objectiveValue(matrix, b, x, lambda)).toBeLessThanOrEqual(atZero + 1e-9);
            previousNorm = norm;
        }
    });

    it("regularization stabilizes an ill-conditioned system", () => {
        const matrix = [[1, 1], [2, 2.0001]];
        const b = [2, 4];
        const unregularized = tikhonov(matrix, b, 0);
        const regularized = tikhonov(matrix, b, 1);
        const norm = (x: number[]) => Math.sqrt(x.reduce((sum, value) => sum + value * value, 0));
        expect(norm(regularized)).toBeLessThan(norm(unregularized));
        expect(Number.isFinite(unregularized[0] as number)).toBe(true);
    });

    it("reports shrinking solutions in its final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["lambda"])).toBe(1);
        expect(Number(final?.["residual"])).toBeGreaterThan(0);
        expect(Number(final?.["residual"])).toBeLessThan(1);
        const sweep = frames.filter((frame) => typeof frame.meta["shrank"] === "boolean");
        expect(sweep.length).toBe(5);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
