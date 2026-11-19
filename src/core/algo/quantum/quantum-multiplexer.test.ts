/**
 * quantum-multiplexer.test.ts - Independent block-matrix cross-check, branch
 * rotation property, normalization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-multiplexer";
import type { VisualFrame } from "@/types";

type Matrix = number[][];

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = frame.meta["amplitudes"] as number[];
        expect(amps.length).toBe(16);
        expect(amps.reduce((sum, v, i) => (i % 2 === 0 ? sum + v ** 2 : sum), 0)).toBeCloseTo(1, 10);
    });
}

/** Independent 8x8 block-diagonal multiplexer matrix. */
function multiplexerMatrix(angles: number[]): Matrix {
    const matrix: Matrix = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
    for (let j = 0; j < 4; j += 1) {
        const c = Math.cos(angles[j]! / 2);
        const s = Math.sin(angles[j]! / 2);
        matrix[2 * j]![2 * j] = c;
        matrix[2 * j]![2 * j + 1] = -s;
        matrix[2 * j + 1]![2 * j] = s;
        matrix[2 * j + 1]![2 * j + 1] = c;
    }
    return matrix;
}

function apply(matrix: Matrix, vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, v, i) => sum + v * (vector[i] ?? 0), 0));
}

describe("QuantumMultiplexer", () => {
    it("matches the independently formed block-diagonal matrix", () => {
        const angles = [0.3, 0.9, -0.5, 1.4];
        const frames = [...mod.run({ angles })];
        checkFrames(frames);
        const before = (frames[1]!.meta["amplitudes"] as number[]).filter((_v, i) => i % 2 === 0);
        const expected = apply(multiplexerMatrix(angles), before);
        const final = (frames[frames.length - 1]!.meta["amplitudes"] as number[]).filter((_v, i) => i % 2 === 0);
        for (let i = 0; i < 8; i += 1) expect(final[i]).toBeCloseTo(expected[i]!, 11);
    });

    it("applies the correct rotation to every branch", () => {
        const angles = [0.2, 1.0, -1.3, 2.1];
        const frames = [...mod.run({ angles })];
        checkFrames(frames);
        const real = frames[frames.length - 1]!.meta["branchReal"] as number[];
        for (let j = 0; j < 4; j += 1) {
            expect(real[2 * j]).toBeCloseTo(0.5 * Math.cos(angles[j]! / 2), 11);
            expect(real[2 * j + 1]).toBeCloseTo(0.5 * Math.sin(angles[j]! / 2), 11);
        }
    });

    it("uses default angles and clamps invalid inputs", () => {
        const frames = [...mod.run({ angles: [0, 0, 0, Number.NaN] })];
        checkFrames(frames);
        expect((frames[0]!.meta["angles"] as number[])[3]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
