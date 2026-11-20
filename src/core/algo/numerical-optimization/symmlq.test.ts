/**
 * symmlq.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./symmlq";
import type { VisualFrame } from "@/types";

function matVec(a: number[][], v: number[]): number[] {
    return a.map((row) => row.reduce((s, value, j) => s + value * (v[j] ?? 0), 0));
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SYMMLQ solver", () => {
    it("reproduces the solution of a symmetric system (Ax close to b)", () => {
        const cases = [
            { matrix: [[4, 1, 0], [1, 3, 1], [0, 1, 2]], rhs: [1, 2, 3] },
            { matrix: [[2, -1, 0], [-1, 2, -1], [0, -1, 2]], rhs: [1, 0, 1] },
            { matrix: [[5, 1, 1], [1, 4, 1], [1, 1, 3]], rhs: [3, 2, 1] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, steps: testCase.matrix.length })];
            checkFrames(frames, testCase.matrix.length);
            const estimate = frames[frames.length - 1]?.meta["estimate"] as number[];
            expect(Array.isArray(estimate)).toBe(true);
            const ax = matVec(testCase.matrix, estimate);
            for (let i = 0; i < testCase.rhs.length; i += 1) {
                expect(Math.abs((ax[i] ?? 0) - (testCase.rhs[i] ?? 0))).toBeLessThan(1e-8);
            }
        }
    });

    it("reports a nonincreasing residual across Lanczos steps on an SPD system", () => {
        const frames = [...mod.run({ matrix: [[3, 1], [1, 2]], rhs: [1, 1], steps: 2 })];
        expect(frames.length).toBeGreaterThan(2);
        const mid = Number(frames[1]?.meta["residualNorm"]);
        const end = Number(frames[frames.length - 1]?.meta["residualNorm"]);
        expect(end).toBeLessThanOrEqual(mid + 1e-12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
