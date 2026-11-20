/**
 * newtons-method.test.ts - Root correctness, derivative check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, {
    evaluatePolynomial,
    newtonSolve,
    polynomialDerivative,
} from "./newtons-method";
import type { VisualFrame } from "@/types";

/** Expand product (x - r_i) into ascending coefficients. */
function polynomialWithRoots(roots: number[]): number[] {
    let coefficients = [1];
    for (const root of roots) {
        const next = Array<number>(coefficients.length + 1).fill(0);
        for (let i = 0; i < coefficients.length; i += 1) {
            next[i] = (next[i] ?? 0) - root * (coefficients[i] ?? 0);
            next[i + 1] = (next[i + 1] ?? 0) + (coefficients[i] ?? 0);
        }
        coefficients = next;
    }
    return coefficients;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Newton's Method", () => {
    it("converges to a known root on constructed polynomials", () => {
        for (const root of [-2, -0.5, 0, 1, Math.PI]) {
            const coefficients = polynomialWithRoots([root, root + 3]);
            const result = newtonSolve(coefficients, root + 0.05, 1e-10, 60);
            expect(result.converged).toBe(true);
            expect(result.root).toBeCloseTo(root, 7);
            expect(Math.abs(evaluatePolynomial(coefficients, result.root))).toBeLessThan(1e-9);
        }
    });

    it("evaluates the derivative exactly by the coefficient rule", () => {
        const coefficients = [5, -3, 2, 4];
        const derivative = polynomialDerivative(coefficients);
        expect(derivative).toEqual([-3, 4, 12]);
        for (const x of [-2, 0, 0.5, 3]) {
            const h = 1e-6;
            const finite =
                (evaluatePolynomial(coefficients, x + h) - evaluatePolynomial(coefficients, x - h)) /
                (2 * h);
            expect(evaluatePolynomial(derivative, x)).toBeCloseTo(finite, 5);
        }
    });

    it("reaches the square root of two on the default input", () => {
        const input = mod.defaultInput as {
            coefficients: number[];
            initialGuess: number;
            tolerance: number;
            maxIterations: number;
        };
        const result = newtonSolve(input.coefficients, input.initialGuess, input.tolerance, input.maxIterations);
        expect(result.converged).toBe(true);
        expect(result.root).toBeCloseTo(Math.SQRT2, 9);

        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
        expect(Number(frames[frames.length - 1]?.meta["iterations"])).toBe(result.iterations);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
