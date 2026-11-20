/**
 * incomplete-cholesky.test.ts - Pattern-exactness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./incomplete-cholesky";
import type { VisualFrame } from "@/types";

function reference(matrix: number[][]) {
    const n = matrix.length;
    const pattern = matrix.map((row) => row.map((v) => Math.abs(v) > 1e-14));
    const l = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < i; j += 1) {
            if (!pattern[i]![j]) continue;
            let sum = matrix[i]![j]!;
            for (let k = 0; k < j; k += 1) {
                if (pattern[i]![k] && pattern[j]![k]) sum -= l[i]![k]! * l[j]![k]!;
            }
            l[i]![j] = sum / l[j]![j]!;
        }
        let diag = matrix[i]![i]!;
        for (let k = 0; k < i; k += 1) if (pattern[i]![k]) diag -= l[i]![k]! ** 2;
        l[i]![i] = Math.sqrt(diag);
    }
    let patternError = 0;
    let dropped = 0;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let product = 0;
            for (let k = 0; k <= Math.min(i, j); k += 1) product += l[i]![k]! * l[j]![k]!;
            if (pattern[i]![j]) patternError = Math.max(patternError, Math.abs(product - matrix[i]![j]!));
            else if (Math.abs(product - matrix[i]![j]!) > 1e-9) dropped += 1;
        }
    }
    return { l, patternError, dropped };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Incomplete Cholesky IC(0)", () => {
    it("matches an independent reference and is exact on the pattern", () => {
        const matrices = [
            [
                [4, 1, 1, 0],
                [1, 4, 0, 1],
                [1, 0, 4, 1],
                [0, 1, 1, 4],
            ],
            [
                [5, 2, 0, 0],
                [2, 5, 2, 0],
                [0, 2, 5, 2],
                [0, 0, 2, 5],
            ],
            [
                [4, 1],
                [1, 4],
            ],
        ];
        for (const matrix of matrices) {
            const n = matrix.length;
            const frames = [...mod.run({ matrix })];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]!.meta;
            expect(final["failed"]).toBe(false);
            expect(Number(final["patternError"])).toBeLessThan(1e-9);
            const expected = reference(matrix);
            const factor = final["factor"] as number[];
            for (let i = 0; i < n * n; i += 1) {
                expect(Number(factor[i])).toBeCloseTo(expected.l[Math.floor(i / n)]![i % n]!, 8);
            }
            for (let i = 0; i < n; i += 1) {
                expect(Number(factor[i * n + i])).toBeGreaterThan(0);
            }
            expect(final["dropped"]).toBe(expected.dropped);
        }
    });

    it("actually discards fill on the cyclic pattern", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["dropped"])).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
