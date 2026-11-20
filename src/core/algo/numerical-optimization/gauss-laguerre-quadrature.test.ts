/**
 * gauss-laguerre-quadrature.test.ts - Node/weight and exactness checks.
 */

import { describe, expect, it } from "vitest";
import mod, { gaussLaguerre, symmetricEigen } from "./gauss-laguerre-quadrature";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function factorial(k: number): number {
    let result = 1;
    for (let i = 2; i <= k; i += 1) {
        result *= i;
    }
    return result;
}

describe("Gauss-Laguerre Quadrature", () => {
    it("has positive nodes and weights that sum to one", () => {
        for (const n of [1, 2, 3, 5, 8]) {
            const { nodes, weights } = gaussLaguerre(n);
            expect(nodes).toHaveLength(n);
            expect(weights).toHaveLength(n);
            nodes.forEach((node, i) => {
                expect(node).toBeGreaterThan(0);
                expect(weights[i] as number).toBeGreaterThan(0);
                if (i > 0) {
                    expect(node).toBeGreaterThan(nodes[i - 1] as number);
                }
            });
            expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        }
    });

    it("integrates every monomial through degree 2n-1 exactly", () => {
        for (const n of [2, 3, 4, 6]) {
            const { nodes, weights } = gaussLaguerre(n);
            for (let degree = 0; degree <= 2 * n - 1; degree += 1) {
                const sum = nodes.reduce((acc, node, i) => acc + (weights[i] as number) * node ** degree, 0);
                expect(Math.abs(sum - factorial(degree))).toBeLessThan(1e-6);
            }
        }
    });

    it("matches the analytic polynomial integral in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["converged"]).toBe(true);
        expect(Number(final?.["exact"])).toBeCloseTo(10, 8);
        expect(Number(final?.["estimate"])).toBeCloseTo(10, 8);
        expect(Number(final?.["exactForDegree"])).toBe(5);
    });

    it("diagonalizes a symmetric matrix with orthonormal columns", () => {
        const A = [[4, 1, 0], [1, 3, 1], [0, 1, 2]];
        const { values, vectors } = symmetricEigen(A);
        vectors.forEach((column, index) => {
            const norm = column.reduce((acc, v) => acc + v * v, 0);
            expect(norm).toBeCloseTo(1, 9);
            for (let row = 0; row < A.length; row += 1) {
                const product = A[row]!.reduce((acc, a, k) => acc + a * column[k]!, 0);
                expect(product).toBeCloseTo((values[index] as number) * column[row]!, 8);
            }
        });
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
