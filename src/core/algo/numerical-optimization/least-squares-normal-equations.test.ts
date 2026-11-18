/**
 * least-squares-normal-equations.test.ts - Independent solver, optimality properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./least-squares-normal-equations";
import type { VisualFrame } from "@/types";

function reference(a: number[][], b: number[]) {
    const m = a.length;
    const n = a[0]?.length ?? 0;
    const ata = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const atb = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            for (let k = 0; k < m; k += 1) ata[i]![j]! += a[k]![i]! * a[k]![j]!;
        }
        for (let k = 0; k < m; k += 1) atb[i]! += a[k]![i]! * b[k]!;
    }
    const aug = ata.map((row, i) => [...row, atb[i]!]);
    for (let c = 0; c < n; c += 1) {
        let p = c;
        for (let i = c + 1; i < n; i += 1) if (Math.abs(aug[i]![c]!) > Math.abs(aug[p]![c]!)) p = i;
        [aug[c], aug[p]] = [aug[p]!, aug[c]!];
        for (let i = c + 1; i < n; i += 1) {
            const f = aug[i]![c]! / aug[c]![c]!;
            for (let j = c; j <= n; j += 1) aug[i]![j]! -= f * aug[c]![j]!;
        }
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let s = aug[i]![n]!;
        for (let j = i + 1; j < n; j += 1) s -= aug[i]![j]! * x[j]!;
        x[i] = s / aug[i]![i]!;
    }
    return x;
}

function sse(a: number[][], b: number[], x: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        let fit = 0;
        for (let j = 0; j < x.length; j += 1) fit += a[i]![j]! * x[j]!;
        total += (fit - b[i]!) ** 2;
    }
    return total;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        const rows = frame.meta["rows"] as number;
        const cols = frame.meta["cols"] as number;
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("LeastSquaresNormalEquations", () => {
    it("matches an independent normal-equation solve", () => {
        const cases: Array<{ a: number[][]; b: number[] }> = [
            {
                a: [
                    [1, 0],
                    [1, 1],
                    [1, 2],
                    [1, 3],
                ],
                b: [1, 2, 4, 5],
            },
            {
                a: [
                    [1, 1],
                    [1, -1],
                    [2, 1],
                ],
                b: [3, 1, 5],
            },
            {
                a: [
                    [2, 0, 1],
                    [0, 1, 1],
                    [1, 1, 1],
                    [3, 2, 0],
                ],
                b: [1, 2, 3, 4],
            },
        ];
        for (const { a, b } of cases) {
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const x = final?.["x"] as number[];
            const expected = reference(a, b);
            x.forEach((value, j) => expect(value).toBeCloseTo(expected[j]!, 9));
        }
    });

    it("the residual is orthogonal to every column and the fit is optimal", () => {
        const a = [
            [1, 0],
            [1, 1],
            [1, 2],
            [1, 3],
        ];
        const b = [1, 2, 4, 5];
        const frames = [...mod.run({ a, b })];
        const x = frames[frames.length - 1]?.meta["x"] as number[];
        expect(x[0]!).toBeCloseTo(0.9, 10);
        expect(x[1]!).toBeCloseTo(1.4, 10);
        for (let j = 0; j < 2; j += 1) {
            let gradient = 0;
            for (let i = 0; i < a.length; i += 1) {
                let fit = 0;
                for (let k = 0; k < 2; k += 1) fit += a[i]![k]! * x[k]!;
                gradient += a[i]![j]! * (fit - b[i]!);
            }
            expect(gradient).toBeCloseTo(0, 9);
        }
        const best = sse(a, b, x);
        expect(frames[frames.length - 1]?.meta["residual"]).toBeCloseTo(best, 9);
        for (const delta of [0.01, -0.01, 0.1, -0.1]) {
            expect(sse(a, b, [x[0]! + delta, x[1]!])).toBeGreaterThanOrEqual(best - 1e-9);
            expect(sse(a, b, [x[0]!, x[1]! + delta])).toBeGreaterThanOrEqual(best - 1e-9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
