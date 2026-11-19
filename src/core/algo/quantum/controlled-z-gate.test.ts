/**
 * controlled-z-gate.test.ts - Matrix cross-check, phase property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./controlled-z-gate";
import type { VisualFrame } from "@/types";

function toPairs(flat: number[]): Array<[number, number]> {
    return Array.from({ length: flat.length / 2 }, (_, i) => [flat[2 * i] ?? 0, flat[2 * i + 1] ?? 0]);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const amps = toPairs(frame.meta["amplitudes"] as number[]);
        const norm = amps.reduce((sum, z) => sum + z[0] * z[0] + z[1] * z[1], 0);
        expect(norm).toBeCloseTo(1, 10);
    });
}

type Matrix = number[][];

function multiply(a: Matrix, b: Matrix): Matrix {
    return a.map((row) => b[0]!.map((_, col) => row.reduce((sum, value, k) => sum + value * (b[k]![col] ?? 0), 0)));
}

describe("ControlledZGate", () => {
    it("negates only the |11> amplitude for each basis state", () => {
        for (let index = 0; index < 4; index += 1) {
            const amplitudes: Array<[number, number]> = [[0, 0], [0, 0], [0, 0], [0, 0]];
            amplitudes[index] = [1, 0];
            const frames = [...mod.run({ amplitudes })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const out = toPairs(final?.["amplitudes"] as number[]);
            for (let i = 0; i < 4; i += 1) {
                const expected = i === index ? (i === 3 ? -1 : 1) : 0;
                expect(out[i]?.[0]).toBeCloseTo(expected, 12);
                expect(out[i]?.[1]).toBeCloseTo(0, 12);
            }
        }
    });

    it("matches the Hadamard-conjugated CNOT matrix computed independently", () => {
        const s = Math.SQRT1_2;
        const h = [[s, s], [s, -s]];
        const identity2 = [[1, 0], [0, 1]];
        const kron = (a: Matrix, b: Matrix): Matrix => {
            const result: Matrix = [];
            for (const ar of a) {
                for (const br of b) {
                    const row: number[] = [];
                    for (const av of ar) for (const bv of br) row.push(av * bv);
                    result.push(row);
                }
            }
            return result;
        };
        const hadamardTarget = kron(identity2, h);
        const cnot = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 0, 1],
            [0, 0, 1, 0],
        ];
        const decomposition = multiply(hadamardTarget, multiply(cnot, hadamardTarget));
        const expected = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, -1]];
        for (let row = 0; row < 4; row += 1) {
            for (let col = 0; col < 4; col += 1) {
                expect(decomposition[row]?.[col]).toBeCloseTo(expected[row]?.[col] ?? 0, 12);
            }
        }
    });

    it("preserves probabilities and is self-inverse", () => {
        const amplitudes: Array<[number, number]> = [[0.5, 0], [0.5, 0], [0.5, 0], [0.5, 0]];
        const frames = [...mod.run({ amplitudes })];
        checkFrames(frames);
        const before = toPairs(frames[0]?.meta["amplitudes"] as number[]).map((z) => z[0] ** 2 + z[1] ** 2);
        const after = frames[frames.length - 1]?.meta["probabilities"] as number[];
        for (let i = 0; i < 4; i += 1) expect(after[i]).toBeCloseTo(before?.[i] ?? 0, 12);
        expect(frames[frames.length - 1]?.meta["selfInverse"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
