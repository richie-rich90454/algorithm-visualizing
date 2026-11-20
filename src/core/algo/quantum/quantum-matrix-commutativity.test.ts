/**
 * quantum-matrix-commutativity.test.ts - Independent commutator cross-check,
 * commuting and anticommuting examples, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-matrix-commutativity";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent 2x2 commutator overlap computation. */
function overlap(a: number[][], b: number[][]): number {
    const mul = (x: number[][], y: number[][]): number[][] => [
        [x[0][0] * y[0][0] + x[0][1] * y[1][0], x[0][0] * y[0][1] + x[0][1] * y[1][1]],
        [x[1][0] * y[0][0] + x[1][1] * y[1][0], x[1][0] * y[0][1] + x[1][1] * y[1][1]],
    ];
    const ab = mul(a, b);
    const ba = mul(b, a);
    let sum = 0;
    for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 2; c += 1) {
            sum += (ab[r][c] - ba[r][c]) ** 2;
        }
    }
    return sum;
}

describe("Quantum Matrix Commutativity Test", () => {
    const diagonalA = [[2, 0], [0, 3]];
    const diagonalB = [[5, 0], [0, 7]];
    const pauliX = [[0, 1], [1, 0]];
    const pauliZ = [[1, 0], [0, -1]];

    it("matches an independent commutator computation", () => {
        const cases: Array<[number[][], number[][]]> = [
            [diagonalA, diagonalB],
            [pauliX, pauliZ],
            [[[1, 2], [3, 4]], [[0, 5], [6, 7]]],
        ];
        for (const [a, b] of cases) {
            const frames = [...mod.run({ matrixA: a, matrixB: b })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!.meta;
            const expected = overlap(a, b);
            expect(Number(last["overlapNormSquared"])).toBeCloseTo(expected, 10);
            expect(last["commute"]).toBe(expected < 1e-12);
        }
    });

    it("reports commuting diagonals and noncommuting Pauli matrices", () => {
        const diag = [...mod.run({ matrixA: diagonalA, matrixB: diagonalB })];
        checkFrames(diag);
        expect(diag[diag.length - 1]!.meta["commute"]).toBe(true);
        const pauli = [...mod.run({ matrixA: pauliX, matrixB: pauliZ })];
        checkFrames(pauli);
        expect(pauli[pauli.length - 1]!.meta["commute"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
