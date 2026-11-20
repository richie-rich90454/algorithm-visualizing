/**
 * successive-over-relaxation.test.ts - Gaussian-elimination cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./successive-over-relaxation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * (n + 2));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent exact solve of a two by two system by Cramer's rule. */
function exact2x2(a: number[][], b: number[]): number[] {
    const det = (a[0]?.[0] ?? 0) * (a[1]?.[1] ?? 0) - (a[0]?.[1] ?? 0) * (a[1]?.[0] ?? 0);
    const x0 = ((b[0] ?? 0) * (a[1]?.[1] ?? 0) - (a[0]?.[1] ?? 0) * (b[1] ?? 0)) / det;
    const x1 = ((a[0]?.[0] ?? 0) * (b[1] ?? 0) - (b[0] ?? 0) * (a[1]?.[0] ?? 0)) / det;
    return [x0, x1];
}

describe("SuccessiveOverRelaxation", () => {
    it("matches Cramer's rule on symmetric positive definite systems", () => {
        const cases = [
            { a: [[4, 1], [1, 3]], b: [1, 2], omega: 1.5 },
            { a: [[5, 2], [2, 6]], b: [3, 1], omega: 1.2 },
            { a: [[10, 1], [1, 8]], b: [4, -2], omega: 1.7 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, iterations: 200 })];
            checkFrames(frames, 2);
            const solution = frames[frames.length - 1]?.meta["solution"] as number[];
            const exact = exact2x2(testCase.a, testCase.b);
            expect(solution[0]).toBeCloseTo(exact[0], 8);
            expect(solution[1]).toBeCloseTo(exact[1], 8);
            expect(frames[frames.length - 1]?.meta["residual"]).toBeLessThan(1e-9);
        }
    });

    it("uses the new value for earlier unknowns and reports convergence", () => {
        const frames = [...mod.run({ iterations: 200 })];
        checkFrames(frames, 2);
        expect(frames.length).toBeGreaterThan(2);
        expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
        expect(frames[frames.length - 1]?.meta["omega"]).toBe(1.5);
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
