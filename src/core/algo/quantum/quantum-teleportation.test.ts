/**
 * quantum-teleportation.test.ts - Explicit 8x8 gate matrices, all measurement
 * outcomes, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-teleportation";
import type { VisualFrame } from "@/types";

type Matrix = number[][];

/** Matrix-vector product, written independently of the module's gate helpers. */
function apply(state: number[], matrix: Matrix): number[] {
    return matrix.map((row) => row.reduce((sum, entry, j) => sum + entry * (state[j] ?? 0), 0));
}

/** Explicit Hadamard matrix for one qubit of an eight-dimensional space. */
function hadamardMatrix(target: number): Matrix {
    const bit = 1 << target;
    const s = 1 / Math.sqrt(2);
    const matrix: Matrix = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
    for (let j = 0; j < 8; j += 1) {
        const output = (j & bit) === 0 ? j : j ^ bit;
        const sign = (j & bit) === 0 ? 1 : -1;
        matrix[output]![j] = s;
        matrix[output ^ bit]![j] = sign * s;
    }
    return matrix;
}

/** Explicit permutation matrix for controlled-NOT. */
function cnotMatrix(control: number, target: number): Matrix {
    const cbit = 1 << control;
    const tbit = 1 << target;
    const matrix: Matrix = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
    for (let j = 0; j < 8; j += 1) {
        const output = (j & cbit) !== 0 ? j ^ tbit : j;
        matrix[output]![j] = 1;
    }
    return matrix;
}

/** Explicit Pauli-X / Pauli-Z matrices for one qubit. */
function xMatrix(target: number): Matrix {
    const bit = 1 << target;
    const matrix: Matrix = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
    for (let j = 0; j < 8; j += 1) {
        matrix[j ^ bit]![j] = 1;
    }
    return matrix;
}

function zMatrix(target: number): Matrix {
    const bit = 1 << target;
    return Array.from({ length: 8 }, (_, i) =>
        Array.from({ length: 8 }, (_, j) => (i === j ? ((j & bit) !== 0 ? -1 : 1) : 0)),
    );
}

/** Independent reference: propagate the circuit for a forced outcome. */
function reference(alpha: number, beta: number, outcome: number): number[] {
    let state = new Array<number>(8).fill(0);
    state[0] = alpha;
    state[1] = beta;
    state = apply(state, hadamardMatrix(1));
    state = apply(state, cnotMatrix(1, 2));
    state = apply(state, cnotMatrix(0, 1));
    state = apply(state, hadamardMatrix(0));

    const m0 = outcome & 1;
    const m1 = (outcome >> 1) & 1;
    const kept = [state[outcome] ?? 0, state[(1 << 2) | outcome] ?? 0];
    const probability = kept.reduce((sum, a) => sum + a * a, 0);
    state = new Array<number>(8).fill(0);
    state[outcome] = (kept[0] ?? 0) / Math.sqrt(probability);
    state[(1 << 2) | outcome] = (kept[1] ?? 0) / Math.sqrt(probability);
    if (m1 === 1) {
        state = apply(state, xMatrix(2));
    }
    if (m0 === 1) {
        state = apply(state, zMatrix(2));
    }
    return [state[outcome] ?? 0, state[(1 << 2) | outcome] ?? 0];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("QuantumTeleportation", () => {
    it("matches explicit matrix propagation for every outcome and input state", () => {
        const cases: Array<[number, number]> = [
            [1, 0],
            [0, 1],
            [Math.SQRT1_2, Math.SQRT1_2],
            [Math.SQRT1_2, -Math.SQRT1_2],
            [0.6, 0.8],
        ];
        for (const [alpha, beta] of cases) {
            for (let outcome = 0; outcome < 4; outcome += 1) {
                const frames = [...mod.run({ alpha, beta, measure: outcome })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta["recovered"] as number[];
                const expected = reference(alpha, beta, outcome);
                expect(final[0]).toBeCloseTo(expected[0]!, 12);
                expect(final[1]).toBeCloseTo(expected[1]!, 12);
                expect(final[0]).toBeCloseTo(alpha, 12);
                expect(final[1]).toBeCloseTo(beta, 12);
            }
        }
    });

    it("keeps every state vector normalized and reports probabilities that sum to one", () => {
        const frames = [...mod.run({ alpha: Math.SQRT1_2, beta: Math.SQRT1_2 })];
        checkFrames(frames);
        for (const frame of frames) {
            const amplitudes = frame.meta["amplitudes"] as number[];
            const norm = amplitudes.reduce((sum, a) => sum + a * a, 0);
            expect(norm).toBeCloseTo(1, 12);
        }
        const measured = frames.find((frame) => frame.meta["measured"] !== -1);
        const probabilities = measured?.meta["probabilities"] as number[];
        expect(probabilities).toHaveLength(4);
        expect(probabilities.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
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
