/**
 * quantum-principal-component-analysis.test.ts - Taylor-series matrix
 * exponential cross-check, eigenvalue peak property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-principal-component-analysis";
import type { VisualFrame } from "@/types";

type C = [number, number];
type Matrix = C[][];

const cAdd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const cMul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];

function matMul(a: Matrix, b: Matrix): Matrix {
    return a.map((row) => b[0]!.map((_v, col) => row.reduce((sum, z, k) => cAdd(sum, cMul(z, b[k]![col]!)), [0, 0] as C)));
}

/** Independent exp(i * 2 pi * s * rho) by scaled Taylor series and squaring. */
function matrixExponential(a: number, b: number, s: number): Matrix {
    const squares = 3;
    const angle = (2 * Math.PI * s) / 2 ** squares;
    const base: Matrix = [
        [[0, angle * a], [0, angle * b]],
        [[0, angle * b], [0, angle * (1 - a)]],
    ];
    let term: Matrix = [[[1, 0], [0, 0]], [[0, 0], [1, 0]]];
    let sum = term.map((row) => row.map((z) => [...z] as C));
    let factorial = 1;
    for (let n = 1; n <= 24; n += 1) {
        term = matMul(term, base);
        factorial *= n;
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                const z = term[i]![j]!;
                sum[i]![j] = cAdd(sum[i]![j]!, [z[0] / factorial, z[1] / factorial]);
            }
        }
    }
    for (let i = 0; i < squares; i += 1) sum = matMul(sum, sum);
    return sum;
}

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
        expect(amps.length).toBe(32);
        expect(amps.reduce((sum, v, i) => (i % 2 === 0 ? sum + v ** 2 + amps[i + 1]! ** 2 : sum), 0)).toBeCloseTo(1, 9);
    });
}

describe("QuantumPrincipalComponentAnalysis", () => {
    it("matches independently exponentiated controlled powers", () => {
        const a = 0.7;
        const b = 0.2;
        const frames = [...mod.run({ a, b })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const real = final["uReal"] as number[];
        const imag = final["uImag"] as number[];
        for (let k = 0; k < 3; k += 1) {
            const exact = matrixExponential(a, b, 2 ** k);
            for (let i = 0; i < 2; i += 1) {
                for (let j = 0; j < 2; j += 1) {
                    const offset = 4 * k + 2 * i + j;
                    expect(real[offset]).toBeCloseTo(exact[i]![j]![0], 9);
                    expect(imag[offset]).toBeCloseTo(exact[i]![j]![1], 9);
                }
            }
        }
    });

    it("peaks at the integer nearest eight times the dominant eigenvalue", () => {
        for (const [a, b] of [[0.7, 0.2], [0.9, 0.1], [0.6, -0.3], [0.5, 0.49]]) {
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const lambda0 = final["lambda0"] as number;
            const expectedPeak = Math.round(8 * lambda0) % 8;
            expect(final["peak"]).toBe(expectedPeak);
            const circular = Math.min(Math.abs(lambda0 - (final["estimate"] as number)), 1 - Math.abs(lambda0 - (final["estimate"] as number)));
            expect(circular).toBeLessThanOrEqual(0.125 + 1e-9);
            const probs = final["probabilities"] as number[];
            expect(probs.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 10);
        }
    });

    it("clamps invalid density-matrix entries", () => {
        const frames = [...mod.run({ a: 0.2, b: 9 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const bound = Math.sqrt(0.2 * 0.8) * 0.999;
        expect(final["b"]).toBeCloseTo(bound, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
