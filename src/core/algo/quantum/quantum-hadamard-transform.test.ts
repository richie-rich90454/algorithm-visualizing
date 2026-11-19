/**
 * quantum-hadamard-transform.test.ts - Kronecker-product matrix cross-check,
 * involution and parity-sign properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-hadamard-transform";
import type { VisualFrame } from "@/types";

type Matrix = number[][];

const H: Matrix = [
    [Math.SQRT1_2, Math.SQRT1_2],
    [Math.SQRT1_2, -Math.SQRT1_2],
];

function kron(a: Matrix, b: Matrix): Matrix {
    const out: Matrix = [];
    for (const ar of a) {
        for (const br of b) {
            const row: number[] = [];
            for (const av of ar) for (const bv of br) row.push(av * bv);
            out.push(row);
        }
    }
    return out;
}

function hadamardMatrix(n: number): Matrix {
    let result: Matrix = [[1]];
    for (let i = 0; i < n; i += 1) result = kron(result, H);
    return result;
}

function multiply(a: Matrix, b: Matrix): Matrix {
    return a.map((row) => b[0]!.map((_value, col) => row.reduce((sum, v, k) => sum + v * (b[k]![col] ?? 0), 0)));
}

function apply(matrix: Matrix, vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, v, i) => sum + v * (vector[i] ?? 0), 0));
}

function checkFrames(frames: VisualFrame[], qubits: number): void {
    const size = 2 ** qubits;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(size);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.length).toBe(size * 2);
        expect(amps.reduce((sum, v, i) => (i % 2 === 0 ? sum + v ** 2 : sum), 0)).toBeCloseTo(1, 10);
    });
}

describe("QuantumHadamardTransform", () => {
    it("matches the independently built Kronecker matrix for each basis state", () => {
        const n = 3;
        const matrix = hadamardMatrix(n);
        for (let basis = 0; basis < 2 ** n; basis += 1) {
            const frames = [...mod.run({ qubits: n, basis })];
            checkFrames(frames, n);
            const input = Array.from({ length: 2 ** n }, (_, i) => (i === basis ? 1 : 0));
            const expected = apply(matrix, input);
            const final = frames[frames.length - 1]!.meta["amplitudes"] as number[];
            for (let i = 0; i < 2 ** n; i += 1) expect(final[2 * i]).toBeCloseTo(expected[i]!, 11);
        }
    });

    it("is an involution and obeys the parity sign formula", () => {
        const n = 3;
        const matrix = hadamardMatrix(n);
        const square = multiply(matrix, matrix);
        for (let i = 0; i < square.length; i += 1) {
            for (let j = 0; j < square.length; j += 1) {
                expect(square[i]![j]!).toBeCloseTo(i === j ? 1 : 0, 11);
            }
        }
        const frames = [...mod.run({ qubits: n, basis: 5 })];
        const signs = frames[frames.length - 1]!.meta["signs"] as number[];
        for (let x = 0; x < 8; x += 1) {
            let parity = 0;
            let bits = x & 5;
            while (bits > 0) {
                parity ^= bits & 1;
                bits >>= 1;
            }
            expect(signs[x]).toBe(parity === 0 ? 1 : -1);
        }
    });

    it("clamps the qubit count into the supported range", () => {
        const frames = [...mod.run({ qubits: 9, basis: 0 })];
        checkFrames(frames, 4);
        expect(frames[0]!.meta["qubits"]).toBe(4);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
