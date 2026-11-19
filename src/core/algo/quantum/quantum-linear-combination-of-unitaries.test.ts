/** quantum-linear-combination-of-unitaries.test.ts - Direct matrix cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./quantum-linear-combination-of-unitaries";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Explicit 4 by 4 matrices for single-qubit I, X, Z tensor factors. */
function pauliMatrix(label: string): number[][] {
    const single: Record<string, number[][]> = {
        I: [[1, 0], [0, 1]],
        X: [[0, 1], [1, 0]],
        Z: [[1, 0], [0, -1]],
    };
    const first = single[label[0] ?? "I"] ?? single["I"]!;
    const second = single[label[1] ?? "I"] ?? single["I"]!;
    const matrix = [
        [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
    ];
    for (let a = 0; a < 2; a += 1) {
        for (let b = 0; b < 2; b += 1) {
            for (let c = 0; c < 2; c += 1) {
                for (let d = 0; d < 2; d += 1) {
                    const row = 2 * a + c;
                    const column = 2 * b + d;
                    matrix[row]![column] = (matrix[row]![column] ?? 0) + (first[a]?.[b] ?? 0) * (second[c]?.[d] ?? 0);
                }
            }
        }
    }
    return matrix;
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0));
}

describe("Quantum Linear Combination of Unitaries", () => {
    it("matches an independently built matrix sum", () => {
        const input = mod.defaultInput as { initial: number; terms: Array<{ pauli: string; coefficient: number }> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const start = [0, 0, 0, 0];
        start[input.initial] = 1;
        const summed = [0, 0, 0, 0];
        for (const term of input.terms) {
            const contribution = matVec(pauliMatrix(term.pauli), start).map((value) => value * term.coefficient);
            contribution.forEach((value, index) => {
                summed[index] = (summed[index] ?? 0) + value;
            });
        }
        const lambda = Math.sqrt(summed.reduce((sum, value) => sum + value * value, 0));
        const expected = summed.map((value) => value / lambda);
        const final = frames[frames.length - 1]?.meta["amplitudes"] as number[];
        expected.forEach((value, index) => expect(final[index] ?? 0).toBeCloseTo(value ?? 0, 9));
        expect(final.reduce((sum, value) => sum + value * value, 0)).toBeCloseTo(1, 9);
    });

    it("reduces to a single Pauli application with one term", () => {
        const frames = [...mod.run({ initial: 0, terms: [{ pauli: "XX", coefficient: 1 }] })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta["amplitudes"] as number[];
        expect(final).toEqual([0, 0, 0, 1]);
        expect(Number(frames[frames.length - 1]?.meta["lambda"])).toBeCloseTo(1, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
