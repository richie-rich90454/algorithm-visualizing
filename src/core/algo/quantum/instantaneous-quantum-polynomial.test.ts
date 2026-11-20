/** instantaneous-quantum-polynomial.test.ts - Dense unitary cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./instantaneous-quantum-polynomial";
import type { VisualFrame } from "@/types";

type Complex = [number, number];

/** Kronecker product of two complex matrices. */
function kron(a: Complex[][], b: Complex[][]): Complex[][] {
    const result: Complex[][] = [];
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            result.push([]);
        }
    }
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < a[i]!.length; j += 1) {
            for (let k = 0; k < b.length; k += 1) {
                for (let l = 0; l < b[k]!.length; l += 1) {
                    const ar = a[i]![j]![0];
                    const ai = a[i]![j]![1];
                    const br = b[k]![l]![0];
                    const bi = b[k]![l]![1];
                    result[i * b.length + k]![j * b[k]!.length + l] = [ar * br - ai * bi, ar * bi + ai * br];
                }
            }
        }
    }
    return result;
}

function hadamardPower(n: number): Complex[][] {
    const inv = Math.SQRT1_2;
    let matrix: Complex[][] = [
        [[inv, 0], [inv, 0]],
        [[inv, 0], [-inv, 0]],
    ];
    for (let q = 1; q < n; q += 1) {
        matrix = kron(matrix, [
            [[inv, 0], [inv, 0]],
            [[inv, 0], [-inv, 0]],
        ]);
    }
    return matrix;
}

function multiply(a: Complex[][], b: Complex[][]): Complex[][] {
    return a.map((row, i) => b[0]!.map((_, j) => {
        let re = 0;
        let im = 0;
        for (let k = 0; k < b.length; k += 1) {
            const ar = row[k]![0];
            const ai = row[k]![1];
            const br = b[k]![j]![0];
            const bi = b[k]![j]![1];
            re += ar * br - ai * bi;
            im += ar * bi + ai * br;
        }
        return [re, im] as Complex;
    }));
}

/** Independent dense-matrix simulation of the IQP circuit. */
function denseProbabilities(n: number, seed: number): number[] {
    const dim = 1 << n;
    const h = hadamardPower(n);
    const singles = Array.from({ length: n }, (_, p) => (seed + 3 * p) % 4);
    const d: Complex[][] = Array.from({ length: dim }, (_, s) =>
        Array.from({ length: dim }, (_, t) => {
            if (s !== t) {
                return [0, 0] as Complex;
            }
            let units = 0;
            for (let p = 0; p < n; p += 1) {
                if ((s & (1 << p)) !== 0) {
                    units += singles[p] ?? 0;
                }
            }
            for (let p = 0; p < n; p += 1) {
                for (let q = p + 1; q < n; q += 1) {
                    const coefficient = (seed * (p + 1) + 3 * q + p) % 5;
                    if ((s & (1 << p)) !== 0 && (s & (1 << q)) !== 0) {
                        units += coefficient;
                    }
                }
            }
            const angle = (units * Math.PI) / 4;
            return [Math.cos(angle), Math.sin(angle)] as Complex;
        }),
    );
    const u = multiply(h, multiply(d, h));
    return u.map((row) => {
        const re = row[0]![0];
        const im = row[0]![1];
        return re * re + im * im;
    });
}

function checkFrames(frames: VisualFrame[], codeLines: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(codeLines);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        });
    });
}

describe("Instantaneous quantum polynomial circuit", () => {
    it("matches an independently built dense IQP unitary", () => {
        for (const n of [1, 2, 3]) {
            for (const seed of [0, 7, 13]) {
                const frames = [...mod.run({ qubits: n, seed })];
                checkFrames(frames, mod.pseudocode?.length ?? 0);
                const final = frames[frames.length - 1]?.meta;
                const probabilities = final?.["probabilities"] as number[];
                const expected = denseProbabilities(n, seed);
                expect(probabilities).toHaveLength(1 << n);
                for (let s = 0; s < expected.length; s += 1) {
                    expect(probabilities[s]).toBeCloseTo(expected[s] ?? 0, 10);
                }
                expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
            }
        }
    });

    it("uses commuting diagonal phases whose order does not matter", () => {
        const frames = [...mod.run({ qubits: 3, seed: 7 })];
        const final = frames[frames.length - 1]?.meta;
        const units = final?.["phaseUnits"] as number[];
        expect(units).toHaveLength(8);
        expect(units[0]).toBe(0);
        for (const unit of units) {
            expect(Number.isInteger(unit)).toBe(true);
        }
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
