/**
 * smith-normal-form.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./smith-normal-form";
import type { VisualFrame } from "@/types";

/** Independent exact determinant via Laplace expansion for small matrices. */
function det(matrix: number[][]): bigint {
    const n = matrix.length;
    if (n === 1) {
        return BigInt(matrix[0]![0] ?? 0);
    }
    let total = 0n;
    for (let c = 0; c < n; c += 1) {
        const minor = matrix
            .slice(1)
            .map((row) => row.filter((_value, j) => j !== c));
        const sign = c % 2 === 0 ? 1n : -1n;
        total += sign * BigInt(matrix[0]![c] ?? 0) * det(minor);
    }
    return total;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
    });
}

function diagonal(frames: VisualFrame[]): bigint[] {
    const raw = frames[frames.length - 1]?.meta["diagonal"];
    expect(Array.isArray(raw)).toBe(true);
    return (raw as string[]).map((value) => BigInt(value));
}

describe("Smith Normal Form", () => {
    it("matches known invariant factors", () => {
        const cases: Array<[number[][], string[]]> = [
            [[[2, 4], [4, 8]], ["2"]],
            [[[2, 0], [0, 3]], ["1", "6"]],
            [[[4, 6], [6, 9]], ["1"]],
            [[[6, 0], [0, 12]], ["6", "12"]],
        ];
        for (const [matrix, expected] of cases) {
            const frames = [...mod.run({ matrix })];
            checkFrames(frames);
            expect(diagonal(frames).map(String)).toEqual(expected);
        }
    });

    it("has a divisibility chain and rank matching the matrix", () => {
        const matrices = [
            [[2, 4], [4, 8]],
            [[2, 0], [0, 3]],
            [[1, 2, 3], [4, 5, 6], [7, 8, 10]],
        ];
        for (const matrix of matrices) {
            const frames = [...mod.run({ matrix })];
            const diag = diagonal(frames);
            for (let i = 1; i < diag.length; i += 1) {
                expect((diag[i] ?? 0n) % (diag[i - 1] ?? 1n)).toBe(0n);
            }
            if (matrix.length === matrix[0]!.length) {
                const target = det(matrix);
                if (target !== 0n) {
                    const product = diag.reduce((a, b) => a * b, 1n);
                    expect(product).toBe(target < 0n ? -target : target);
                }
            }
        }
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
