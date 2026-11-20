/**
 * unitary-coupled-cluster.test.ts - Independent matrix exponential, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./unitary-coupled-cluster";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function referenceVector(qubits: number, reference: string): number[] {
    const dimension = 1 << qubits;
    const vector = Array.from({ length: dimension }, () => 0);
    let index = 0;
    for (let qubit = 0; qubit < qubits; qubit += 1) {
        if (reference[qubit] === "1") index |= 1 << qubit;
    }
    vector[index] = 1;
    return vector;
}

/** Apply exp(theta G) to a vector by a Taylor series, with G read off the excitation. */
function applyExcitation(
    vector: number[],
    dimension: number,
    p: number,
    q: number,
    theta: number,
): number[] {
    const generator = Array.from({ length: dimension }, () => Array.from({ length: dimension }, () => 0));
    for (let index = 0; index < dimension; index += 1) {
        const bitP = ((index >> p) & 1) === 1;
        const bitQ = ((index >> q) & 1) === 1;
        if (bitP === bitQ) continue;
        const partner = index ^ (1 << p) ^ (1 << q);
        if (bitP) {
            generator[partner]![index] = -1;
            generator[index]![partner] = 1;
        }
    }
    let result = [...vector];
    let term = [...vector];
    for (let order = 1; order <= 40; order += 1) {
        const next = Array.from({ length: dimension }, () => 0);
        for (let row = 0; row < dimension; row += 1) {
            for (let col = 0; col < dimension; col += 1) {
                next[row] = (next[row] ?? 0) + theta * (generator[row]![col] ?? 0) * (term[col] ?? 0);
            }
        }
        term = next.map((value) => value / order);
        result = result.map((value, index) => value + (term[index] ?? 0));
        if (term.every((value) => Math.abs(value) < 1e-15)) break;
    }
    return result;
}

/** Independent replay: exponentiates each excitation generator in sequence. */
function bruteForceState(qubits: number, reference: string, excitations: number[][], thetas: number[]): number[] {
    const dimension = 1 << qubits;
    let vector = referenceVector(qubits, reference);
    for (let e = 0; e < excitations.length; e += 1) {
        vector = applyExcitation(vector, dimension, excitations[e]![0] ?? 0, excitations[e]![1] ?? 0, thetas[e] ?? 0);
    }
    return vector;
}

describe("Unitary Coupled Cluster State Preparation", () => {
    it("matches an independent matrix exponential", () => {
        const input = mod.defaultInput as { qubits: number; reference: string; excitations: number[][]; thetas: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const amplitudes = final["amplitudes"] as number[];
        const expected = bruteForceState(input.qubits, input.reference, input.excitations, input.thetas);
        amplitudes.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 8));
        expect(Number(final["norm"])).toBeCloseTo(1, 10);
    });

    it("matches a two-excitation replay on four qubits", () => {
        const input = {
            qubits: 4,
            reference: "1010",
            excitations: [[0, 1], [2, 3]],
            thetas: [0.6, -0.3],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const amplitudes = (frames[frames.length - 1]!.meta["amplitudes"]) as number[];
        const expected = bruteForceState(input.qubits, input.reference, input.excitations, input.thetas);
        amplitudes.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 8));
    });

    it("fully swaps the occupation at amplitude pi over two", () => {
        const frames = [...mod.run({ qubits: 2, reference: "10", excitations: [[0, 1]], thetas: [Math.PI / 2] })];
        const amplitudes = (frames[frames.length - 1]!.meta["amplitudes"]) as number[];
        expect(amplitudes[2]!).toBeCloseTo(-1, 9);
        expect(amplitudes[1]!).toBeCloseTo(0, 9);
    });

    it("keeps the state normalized at every frame", () => {
        for (const frame of [...mod.run(mod.defaultInput as object)]) {
            expect(Number(frame.meta["norm"])).toBeCloseTo(1, 9);
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
