/** dai-yuan.test.ts - Brute-force linear solve check, distinct beta check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./dai-yuan";
import type { VisualFrame } from "@/types";

/** Independent Gaussian elimination with partial pivoting. */
function solve(matrix: number[][], vector: number[]): number[] {
    const n = vector.length;
    const a = matrix.map((row, i) => [...row, vector[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(a[r]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) {
                pivot = r;
            }
        }
        [a[col], a[pivot]] = [a[pivot]!, a[col]!];
        const factor = a[col]?.[col] ?? 1;
        for (let c = col; c <= n; c += 1) {
            a[col]![c] = (a[col]![c] ?? 0) / factor;
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) {
                continue;
            }
            const scale = a[r]?.[col] ?? 0;
            for (let c = col; c <= n; c += 1) {
                a[r]![c] = (a[r]![c] ?? 0) - scale * (a[col]![c] ?? 0);
            }
        }
    }
    return a.map((row) => row[n] ?? 0);
}

function checkFrames(frames: VisualFrame[], codeLines: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(codeLines);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        });
    });
}

describe("Dai-Yuan conjugate gradient", () => {
    it("reaches the Gaussian elimination solution within n iterations", () => {
        const cases: Array<{ matrix: number[][]; vector: number[] }> = [
            { matrix: [[4, 1], [1, 3]], vector: [1, 2] },
            { matrix: [[6, 2, 1], [2, 5, 1], [1, 1, 4]], vector: [1, -2, 3] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, maxIterations: 12, tolerance: 1e-12 })];
            checkFrames(frames, mod.pseudocode?.length ?? 0);
            const final = frames[frames.length - 1]?.meta;
            const expected = solve(testCase.matrix, testCase.vector);
            const x = final?.["x"] as number[];
            for (let i = 0; i < expected.length; i += 1) {
                expect(x[i]).toBeCloseTo(expected[i] ?? 0, 9);
            }
            expect(Number(final?.["gradientNorm"])).toBeLessThan(1e-9);
            expect(Number(final?.["iteration"])).toBeLessThanOrEqual(expected.length);
            expect(final?.["converged"]).toBe(true);
        }
    });

    it("uses the Dai-Yuan beta formula based on the gradient change", () => {
        const frames = [...mod.run({ maxIterations: 1 })];
        const final = frames[frames.length - 1]?.meta;
        const betas = final?.["betas"] as number[];
        const gradients = final?.["gradients"] as number[];
        expect(betas).toHaveLength(1);
        const g0 = [-1, -2];
        const p0 = [1, 2];
        const g1 = [0.5, -0.25];
        const gradientChange = [g1[0]! - g0[0]!, g1[1]! - g0[1]!];
        const directionCurvature = p0[0]! * gradientChange[0]! + p0[1]! * gradientChange[1]!;
        const independent = (g1[0]! ** 2 + g1[1]! ** 2) / directionCurvature;
        expect(betas[0]).toBeCloseTo(independent, 12);
        expect(betas[0]).toBeCloseTo(0.0625, 9);
        expect(gradients[1]).toBeCloseTo(Math.hypot(g1[0]!, g1[1]!), 12);
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
