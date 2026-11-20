/**
 * chebyshev-acceleration.test.ts - Solver correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { chebyshevFactors, exactSolve } from "./chebyshev-acceleration";
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

/** Independent power-iteration estimate of the dominant eigenvalue bound. */
function powerBound(matrix: number[][]): number {
    let v = matrix.map((_row, i) => i + 1);
    for (let k = 0; k < 200; k += 1) {
        const w = matrix.map((row) => row.reduce((sum, a, j) => sum + a * (v[j] as number), 0));
        const norm = Math.sqrt(w.reduce((sum, x) => sum + x * x, 0));
        v = w.map((x) => x / norm);
    }
    const Av = matrix.map((row) => row.reduce((sum, a, j) => sum + a * (v[j] as number), 0));
    return v.reduce((sum, value, i) => sum + value * (Av[i] as number), 0);
}

describe("Chebyshev Acceleration", () => {
    it("produces factors that lie inside the stable interval", () => {
        for (const steps of [1, 3, 8, 20]) {
            const factors = chebyshevFactors(2, 5, steps);
            expect(factors).toHaveLength(steps);
            factors.forEach((omega) => {
                expect(omega).toBeGreaterThan(0);
                expect(omega).toBeLessThan(1);
                expect(1 / omega).toBeGreaterThanOrEqual(2 - 1e-9);
                expect(1 / omega).toBeLessThanOrEqual(5 + 1e-9);
            });
        }
    });

    it("converges to the exact solve and reduces the residual overall", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["converged"]).toBe(true);
        expect(Number(final?.["finalResidual"])).toBeLessThan(1e-7);
        const residuals = final?.["residuals"] as number[];
        expect(residuals[residuals.length - 1] as number).toBeLessThan(residuals[0] as number);
        residuals.forEach((value) => expect(Number.isFinite(value)).toBe(true));
        const x = final?.["x"] as number[];
        const reference = final?.["reference"] as number[];
        x.forEach((value, i) => expect(value).toBeCloseTo(reference[i] as number, 6));
    });

    it("agrees with an independent dense solve on a three by three system", () => {
        const matrix = [[5, 1, 0], [1, 4, 1], [0, 1, 3]];
        const rhs = [3, 1, 2];
        const frames = [...mod.run({ matrix, rhs, lower: 2, upper: 6, steps: 14 })];
        const final = frames[frames.length - 1]?.meta;
        const x = final?.["x"] as number[];
        const reference = exactSolve(matrix, rhs);
        x.forEach((value, i) => expect(value).toBeCloseTo(reference[i] as number, 5));
        expect(powerBound(matrix)).toBeGreaterThan(2);
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
