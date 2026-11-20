/**
 * hhl-linear-system.test.ts - Brute-force 2x2 solve, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hhl-linear-system";
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

/** Independent exact 2x2 solve by Cramer's rule. */
function solve2x2(a: number[][], b: number[]): number[] {
    const [[p, q], [r, s]] = a as [[number, number], [number, number]];
    const det = p * s - q * r;
    return [
        ((b[0] ?? 0) * s - q * (b[1] ?? 0)) / det,
        (p * (b[1] ?? 0) - (b[0] ?? 0) * r) / det,
    ];
}

describe("HhlLinearSystem", () => {
    it("matches Cramer's rule and reproduces b on several symmetric systems", () => {
        const cases = [
            { a: [[2, 1], [1, 2]], b: [1, 0] },
            { a: [[4, 2], [2, 5]], b: [3, -1] },
            { a: [[3, 0], [0, 7]], b: [2, 4] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const solution = frames[frames.length - 1]?.meta["solution"] as number[];
            const expected = solve2x2(testCase.a, testCase.b);
            expect(solution[0]).toBeCloseTo(expected[0], 10);
            expect(solution[1]).toBeCloseTo(expected[1], 10);
            const row0 = testCase.a[0] ?? [];
            const row1 = testCase.a[1] ?? [];
            const ax0 = (row0[0] ?? 0) * (solution[0] ?? 0) + (row0[1] ?? 0) * (solution[1] ?? 0);
            const ax1 = (row1[0] ?? 0) * (solution[0] ?? 0) + (row1[1] ?? 0) * (solution[1] ?? 0);
            expect(ax0).toBeCloseTo(testCase.b[0] ?? 0, 10);
            expect(ax1).toBeCloseTo(testCase.b[1] ?? 0, 10);
        }
    });

    it("records eigenvalues and inverse-scaled projections", () => {
        const frames = [...mod.run({ a: [[2, 1], [1, 2]], b: [1, 0] })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const eigenvalues = final?.["eigenvalues"] as number[];
        expect(eigenvalues[0]).toBeCloseTo(3, 10);
        expect(eigenvalues[1]).toBeCloseTo(1, 10);
        const betas = final?.["betas"] as number[];
        const scales = final?.["inverseScales"] as number[];
        expect(scales[0]).toBeCloseTo((betas[0] ?? 0) / (eigenvalues[0] ?? 1), 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
