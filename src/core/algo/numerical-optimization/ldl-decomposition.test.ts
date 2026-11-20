/**
 * ldl-decomposition.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ldl-decomposition";
import type { VisualFrame } from "@/types";

/** Independent LDL^T reference that reconstructs the product itself. */
function reference(matrix: number[][]) {
    const n = matrix.length;
    const lower = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    const diagonal = Array.from({ length: n }, () => 0);
    for (let col = 0; col < n; col += 1) {
        let pivot = matrix[col]![col]!;
        for (let k = 0; k < col; k += 1) pivot -= lower[col]![k]! ** 2 * diagonal[k]!;
        diagonal[col] = pivot;
        for (let row = col + 1; row < n; row += 1) {
            let sum = matrix[row]![col]!;
            for (let k = 0; k < col; k += 1) {
                sum -= lower[row]![k]! * diagonal[k]! * lower[col]![k]!;
            }
            lower[row]![col] = sum / pivot;
        }
    }
    const maxError = (() => {
        let worst = 0;
        for (let row = 0; row < n; row += 1) {
            for (let col = 0; col < n; col += 1) {
                let value = 0;
                for (let k = 0; k <= Math.min(row, col); k += 1) {
                    const lr = k === row ? 1 : lower[row]![k]!;
                    const lc = k === col ? 1 : lower[col]![k]!;
                    value += lr * diagonal[k]! * lc;
                }
                worst = Math.max(worst, Math.abs(value - matrix[row]![col]!));
            }
        }
        return worst;
    })();
    return { lower, diagonal, maxError };
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

function unpack(meta: VisualFrame["meta"], n: number) {
    const lower = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => Number((meta["lower"] as number[])[i * n + j])),
    );
    const diagonal = (meta["diagonal"] as number[]).map(Number);
    return { lower, diagonal };
}

describe("LDL^T decomposition", () => {
    it("reconstructs the input matrix on several SPD matrices", () => {
        const matrices = [
            [
                [4, 1, 0],
                [1, 3, 1],
                [0, 1, 2],
            ],
            [
                [4, 1],
                [1, 3],
            ],
            [
                [6, 2, 1, 0],
                [2, 5, 1, 1],
                [1, 1, 4, 2],
                [0, 1, 2, 5],
            ],
        ];
        for (const matrix of matrices) {
            const n = matrix.length;
            const frames = [...mod.run({ matrix })];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]!.meta;
            expect(final["failed"]).toBe(false);
            expect(Number(final["maxError"])).toBeLessThan(1e-9);
            const expected = reference(matrix);
            const actual = unpack(final, n);
            for (let i = 0; i < n; i += 1) {
                expect(actual.diagonal[i]).toBeCloseTo(expected.diagonal[i]!, 8);
                for (let j = 0; j < n; j += 1) {
                    expect(actual.lower[i]![j]!).toBeCloseTo(expected.lower[i]![j]!, 8);
                }
            }
        }
    });

    it("reports a singular leading minor without emitting NaN", () => {
        const matrix = [
            [1, 1],
            [1, 1],
        ];
        const frames = [...mod.run({ matrix })];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]!.meta;
        expect(final["failed"]).toBe(true);
        for (const frame of frames) {
            for (const entity of frame.entities) {
                expect(Number.isFinite(entity.value as number)).toBe(true);
            }
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
