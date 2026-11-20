/**
 * density-matrix-renormalization-group.test.ts - Eigensolver, variational bound, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, {
    dmrgTruncate,
    exactGroundState,
    isingHamiltonian,
    jacobiEigen,
} from "./density-matrix-renormalization-group";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Density Matrix Renormalization Group", () => {
    it("diagonalizes a symmetric matrix correctly", () => {
        const matrix = [[2, 1], [1, 2]];
        const result = jacobiEigen(matrix);
        expect(result.values[0]).toBeCloseTo(1, 10);
        expect(result.values[1]).toBeCloseTo(3, 10);
        for (const [index, value] of result.values.entries()) {
            const vector = result.vectors[index]!;
            const product = matrix.map((row) => row.reduce((sum, a, j) => sum + a * (vector[j] ?? 0), 0));
            for (let i = 0; i < 2; i += 1) {
                expect(product[i]).toBeCloseTo(value * (vector[i] ?? 0), 9);
            }
        }
    });

    it("finds an exact Ising ground state that satisfies the eigen equation", () => {
        const h = isingHamiltonian(4, 1);
        const { energy, vector } = exactGroundState(h);
        expect(energy).toBeLessThan(0);
        const product = h.map((row) => row.reduce((sum, value, j) => sum + value * (vector[j] ?? 0), 0));
        for (let i = 0; i < vector.length; i += 1) {
            expect(product[i]).toBeCloseTo(energy * (vector[i] ?? 0), 8);
        }
    });

    it("obeys the variational principle and recovers the exact energy at full basis", () => {
        const h = isingHamiltonian(4, 1);
        const ground = exactGroundState(h);
        const result = dmrgTruncate(h, ground.vector, 4, 4);
        for (const level of result.levels) {
            expect(level.energy).toBeGreaterThanOrEqual(result.exactEnergy - 1e-8);
            expect(level.truncationError).toBeCloseTo(1 - level.keptWeight, 9);
        }
        const full = result.levels[result.levels.length - 1]!;
        expect(full.energy).toBeCloseTo(result.exactEnergy, 8);
        expect(full.keptWeight).toBeCloseTo(1, 9);
        expect(full.truncationError).toBeCloseTo(0, 9);
        for (const weight of result.spectrum) expect(weight).toBeGreaterThanOrEqual(-1e-10);
        for (let i = 1; i < result.spectrum.length; i += 1) {
            expect(result.spectrum[i - 1]!).toBeGreaterThanOrEqual(result.spectrum[i]!);
        }
        let previousWeight = 0;
        for (const level of result.levels) {
            expect(level.keptWeight).toBeGreaterThanOrEqual(previousWeight - 1e-10);
            previousWeight = level.keptWeight;
        }
    });

    it("produces well-formed frames ending at the exact ground energy", () => {
        const input = mod.defaultInput as { length: number; field: number; keptStates: number };
        const frames = [...mod.run(input)];
        const leftDim = 1 << (input.length / 2);
        checkFrames(frames, leftDim);
        const final = frames[frames.length - 1]!.meta;
        expect(Number(final["dmrgEnergy"])).toBeCloseTo(Number(final["exactEnergy"]), 8);
        expect(Number(final["keptStates"])).toBe(leftDim);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
