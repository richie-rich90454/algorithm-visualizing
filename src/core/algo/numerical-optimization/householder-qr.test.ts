/**
 * householder-qr.test.ts - Orthogonality and reconstruction properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./householder-qr";
import type { VisualFrame } from "@/types";

function unflatten(flat: number[], rows: number, cols: number): number[][] {
    const result: number[][] = [];
    for (let i = 0; i < rows; i += 1) {
        result.push(flat.slice(i * cols, (i + 1) * cols));
    }
    return result;
}

function gramSchmidt(a: number[][], rows: number, n: number) {
    const q = Array.from({ length: rows }, () => new Array<number>(n).fill(0));
    const r = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let j = 0; j < n; j += 1) {
        let v = a.map((row) => row[j] ?? 0);
        for (let i = 0; i < j; i += 1) {
            const qCol = q.map((row) => row[i] ?? 0);
            const dot = qCol.reduce((sum, value, k) => sum + value * (v[k] ?? 0), 0);
            r[i]![j] = dot;
            v = v.map((value, k) => value - dot * (qCol[k] ?? 0));
        }
        const norm = Math.sqrt(v.reduce((sum, value) => sum + value * value, 0));
        r[j]![j] = norm;
        if (norm > 0) {
            for (let k = 0; k < rows; k += 1) q[k]![j] = (v[k] ?? 0) / norm;
        }
    }
    return { q, r };
}

function checkFrames(frames: VisualFrame[], rows: number, n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    const cols = n + 1 + rows;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(cols);
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect((frame.meta["r"] as number[]).length).toBe(rows * n);
        expect((frame.meta["q"] as number[]).length).toBe(rows * rows);
    });
}

describe("HouseholderQR", () => {
    it("factors A into orthogonal Q and upper triangular R", () => {
        const matrices: number[][][] = [
            [
                [12, -51, 4],
                [6, 167, -68],
                [-4, 24, -41],
            ],
            [
                [3, 1],
                [1, 4],
            ],
            [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
            ],
            [
                [1, 2],
                [3, 4],
                [5, 7],
            ],
        ];
        for (const a of matrices) {
            const rows = a.length;
            const n = a[0]?.length ?? 0;
            const frames = [...mod.run({ a })];
            checkFrames(frames, rows, n);
            const final = frames[frames.length - 1]?.meta;
            const q = unflatten(final?.["q"] as number[], rows, rows);
            const r = unflatten(final?.["r"] as number[], rows, n);
            let reconstruction = 0;
            for (let i = 0; i < rows; i += 1) {
                for (let j = 0; j < n; j += 1) {
                    let sum = 0;
                    for (let k = 0; k < rows; k += 1) sum += (q[i]?.[k] ?? 0) * (r[k]?.[j] ?? 0);
                    reconstruction = Math.max(reconstruction, Math.abs(sum - (a[i]?.[j] ?? 0)));
                }
            }
            expect(reconstruction).toBeLessThan(1e-9);
            expect(final?.["reconstructionError"]).toBeLessThan(1e-9);
            expect(final?.["orthogonalityError"]).toBeLessThan(1e-9);
            for (let i = 0; i < rows; i += 1) {
                for (let j = 0; j < Math.min(i, n); j += 1) {
                    expect(Math.abs(r[i]?.[j] ?? 0)).toBeLessThan(1e-9);
                }
            }
            if (rows === n && n > 0) {
                const gs = gramSchmidt(a, rows, n);
                for (let i = 0; i < rows; i += 1) {
                    for (let j = 0; j < n; j += 1) {
                        let sum = 0;
                        for (let k = 0; k < n; k += 1) sum += (gs.q[i]?.[k] ?? 0) * (gs.r[k]?.[j] ?? 0);
                        expect(Math.abs(sum - (a[i]?.[j] ?? 0))).toBeLessThan(1e-9);
                    }
                }
            }
        }
    });

    it("each reflector frame zeroes the current column below the diagonal", () => {
        const a = [
            [12, -51, 4],
            [6, 167, -68],
            [-4, 24, -41],
        ];
        const frames = [...mod.run({ a })];
        const reflectorFrames = frames.filter((frame) => frame.codeLineNumber === 3);
        expect(reflectorFrames.length).toBe(3);
        reflectorFrames.forEach((frame, k) => {
            const r = unflatten(frame.meta["r"] as number[], a.length, a[0]?.length ?? 0);
            for (let i = k + 1; i < r.length; i += 1) {
                expect(Math.abs(r[i]?.[k] ?? 0)).toBeLessThan(1e-9);
            }
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
