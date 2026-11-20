/**
 * auxiliary-field-quantum-monte-carlo.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./auxiliary-field-quantum-monte-carlo";
import type { VisualFrame } from "@/types";

type Matrix = number[][];

function apply(matrix: Matrix, vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, k) => sum + value * (vector[k] ?? 0), 0));
}

function hamiltonian(h: number, u: number): Matrix {
    const z = (index: number, shift: number) => (((index >> shift) & 1) === 0 ? 1 : -1);
    return Array.from({ length: 4 }, (_, i) =>
        Array.from({ length: 4 }, (_, j) => {
            if (i === j) {
                return -u * z(i, 1) * z(i, 0);
            }
            if ((i ^ j) === 1 || (i ^ j) === 2) {
                return h;
            }
            return 0;
        }),
    );
}

/** Jacobi eigenvalue method for a small symmetric matrix. */
function smallestEigenvalue(input: Matrix): number {
    const a = input.map((row) => [...row]);
    const size = a.length;
    for (let sweep = 0; sweep < 200; sweep += 1) {
        let changed = false;
        for (let p = 0; p < size; p += 1) {
            for (let q = p + 1; q < size; q += 1) {
                const off = a[p]?.[q] ?? 0;
                if (Math.abs(off) < 1e-14) {
                    continue;
                }
                changed = true;
                const app = a[p]?.[p] ?? 0;
                const aqq = a[q]?.[q] ?? 0;
                const theta = (aqq - app) / (2 * off);
                const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
                const c = 1 / Math.sqrt(t * t + 1);
                const s = t * c;
                for (let k = 0; k < size; k += 1) {
                    const akp = a[k]?.[p] ?? 0;
                    const akq = a[k]?.[q] ?? 0;
                    a[k]![p] = c * akp - s * akq;
                    a[k]![q] = s * akp + c * akq;
                }
                for (let k = 0; k < size; k += 1) {
                    const apk = a[p]?.[k] ?? 0;
                    const aqk = a[q]?.[k] ?? 0;
                    a[p]![k] = c * apk - s * aqk;
                    a[q]![k] = s * apk + c * aqk;
                }
            }
        }
        if (!changed) {
            break;
        }
    }
    return Math.min(...a.map((row, index) => row[index] ?? 0));
}

/** Independent matrix-based reproduction of the enumerated field paths. */
function matrixAverage(h: number, u: number, dt: number, slices: number): number {
    const gamma = Math.acosh(Math.exp(2 * dt * u)) / 2;
    const constant = Math.exp(-dt * u) / 2;
    const initial = [0.5, 0.5, 0.5, 0.5];
    const hamilton = hamiltonian(h, u);
    const energies: number[] = [];
    for (let configuration = 0; configuration < 2 ** slices; configuration += 1) {
        let vector = [...initial];
        for (let slice = 0; slice < slices; slice += 1) {
            const sign = ((configuration >> slice) & 1) === 0 ? 1 : -1;
            for (const shift of [1, 0]) {
                const step = Array.from({ length: 4 }, (_, i) =>
                    Array.from({ length: 4 }, (_, j) => {
                        if (i === j) {
                            return Math.cosh(dt * h);
                        }
                        return ((i ^ j) === (1 << shift) ? 1 : 0) * -Math.sinh(dt * h);
                    }),
                );
                vector = apply(step, vector);
            }
            const diagonal = Array.from({ length: 4 }, (_, i) => {
                const z0 = ((i >> 1) & 1) === 0 ? 1 : -1;
                const z1 = (i & 1) === 0 ? 1 : -1;
                return i === 0 || i === 1 || i === 2 || i === 3
                    ? constant * Math.exp(gamma * sign * (z0 + z1))
                    : 0;
            });
            vector = vector.map((value, i) => value * (diagonal[i] ?? 0));
        }
        const numerator = vector.reduce((sum, value, i) =>
            sum + value * apply(hamilton, vector)[i]!, 0);
        const norm = vector.reduce((sum, value) => sum + value * value, 0);
        energies.push(numerator / norm);
    }
    return energies.reduce((a, b) => a + b, 0) / energies.length;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Auxiliary-Field Quantum Monte Carlo", () => {
    const input = mod.defaultInput as { transverseField: number; interaction: number; dt: number; slices: number };

    it("matches an independent matrix-based path enumeration", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["done"]).toBe(true);
        const expected = matrixAverage(input.transverseField, input.interaction, input.dt, input.slices);
        expect(last?.["averageEnergy"] as number).toBeCloseTo(expected, 8);
    });

    it("respects the variational lower bound", () => {
        const frames = [...mod.run(input)];
        const average = frames[frames.length - 1]?.meta["averageEnergy"] as number;
        const ground = smallestEigenvalue(hamiltonian(input.transverseField, input.interaction));
        expect(average).toBeGreaterThanOrEqual(ground - 1e-8);
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
