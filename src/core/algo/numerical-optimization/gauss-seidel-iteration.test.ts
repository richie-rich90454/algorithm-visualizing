/**
 * gauss-seidel-iteration.test.ts - Independent sweep reference, residual check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gauss-seidel-iteration";
import type { VisualFrame } from "@/types";

function reference(a: number[][], b: number[], iterations: number, tolerance: number) {
    const n = a.length;
    const x = new Array<number>(n).fill(0);
    const trace: Array<{ sweep: number; row: number; x: number[] }> = [];
    for (let sweep = 0; sweep < iterations; sweep += 1) {
        for (let i = 0; i < n; i += 1) {
            let sum = b[i] ?? 0;
            for (let j = 0; j < n; j += 1) {
                if (j !== i) sum -= (a[i]?.[j] ?? 0) * (x[j] ?? 0);
            }
            x[i] = sum / (a[i]?.[i] ?? 1);
            trace.push({ sweep: sweep + 1, row: i, x: [...x] });
            let worst = 0;
            for (let r = 0; r < n; r += 1) {
                let rowSum = 0;
                for (let c = 0; c < n; c += 1) rowSum += (a[r]?.[c] ?? 0) * (x[c] ?? 0);
                worst = Math.max(worst, Math.abs(rowSum - (b[r] ?? 0)));
            }
            if (worst < tolerance) return { x, trace };
        }
    }
    return { x, trace };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n + 2);
        expect(frame.entities.length).toBe(n * (n + 2));
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect((frame.meta["x"] as number[]).length).toBe(n);
        expect(typeof frame.meta["residual"]).toBe("number");
    });
}

describe("GaussSeidelIteration", () => {
    it("matches an independent in-place sweep reference step for step", () => {
        const cases: Array<{ a: number[][]; b: number[] }> = [
            { a: [[4, 1], [1, 3]], b: [1, 2] },
            { a: [[10, -1, 2], [-1, 11, -1], [2, -1, 10]], b: [6, 25, -11] },
            { a: [[2, 1], [1, 4]], b: [5, 6] },
        ];
        for (const { a, b } of cases) {
            const frames = [...mod.run({ a, b, iterations: 40, tolerance: 1e-12 })];
            checkFrames(frames, a.length);
            const expected = reference(a, b, 40, 1e-12);
            const updates = frames.filter((frame) => frame.codeLineNumber === 3);
            expect(updates.length).toBe(expected.trace.length);
            updates.forEach((frame, i) => {
                expect(frame.meta["sweep"]).toBe(expected.trace[i]?.sweep);
                expect(frame.meta["row"]).toBe(expected.trace[i]?.row);
                const x = frame.meta["x"] as number[];
                x.forEach((value, j) => expect(value).toBeCloseTo(expected.trace[i]?.x[j] ?? 0, 10));
            });
            const finalX = frames[frames.length - 1]?.meta["x"] as number[];
            finalX.forEach((value, j) => expect(value).toBeCloseTo(expected.x[j] ?? 0, 10));
        }
    });

    it("the final iterate satisfies the original system", () => {
        const a = [
            [4, 1],
            [1, 3],
        ];
        const b = [1, 2];
        const frames = [...mod.run({ a, b, iterations: 40, tolerance: 1e-12 })];
        const x = frames[frames.length - 1]?.meta["x"] as number[];
        expect(a[0]![0]! * x[0]! + a[0]![1]! * x[1]!).toBeCloseTo(b[0]!, 9);
        expect(a[1]![0]! * x[0]! + a[1]![1]! * x[1]!).toBeCloseTo(b[1]!, 9);
        expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
        const residuals = frames.map((frame) => frame.meta["residual"] as number);
        for (let i = 1; i < residuals.length; i += 1) {
            expect(residuals[i]!).toBeLessThanOrEqual(residuals[i - 1]! + 1e-12);
        }
    });

    it("handles a zero diagonal row without producing a nonfinite value", () => {
        const frames = [...mod.run({ a: [[0, 1], [1, 3]], b: [1, 2], iterations: 5 })];
        checkFrames(frames, 2);
        expect(frames[frames.length - 1]?.description).toContain("zero diagonal");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
