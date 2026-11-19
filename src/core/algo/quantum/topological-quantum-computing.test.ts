/**
 * topological-quantum-computing.test.ts - Braid-group identities, independent braid application, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./topological-quantum-computing";
import type { VisualFrame } from "@/types";

type Complex = [number, number];
type Matrix = [[Complex, Complex], [Complex, Complex]];

const PHI = (1 + Math.sqrt(5)) / 2;

const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Complex, b: Complex): Complex => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const phase = (a: number): Complex => [Math.cos(a), Math.sin(a)];

function matMul(a: Matrix, b: Matrix): Matrix {
    return [
        [add(mul(a[0][0], b[0][0]), mul(a[0][1], b[1][0])), add(mul(a[0][0], b[0][1]), mul(a[0][1], b[1][1]))],
        [add(mul(a[1][0], b[0][0]), mul(a[1][1], b[1][0])), add(mul(a[1][0], b[0][1]), mul(a[1][1], b[1][1]))],
    ];
}

function generators(): { s1: Matrix; s2: Matrix; f: Matrix } {
    const f: Matrix = [[[1 / PHI, 0], [1 / Math.sqrt(PHI), 0]], [[1 / Math.sqrt(PHI), 0], [-1 / PHI, 0]]];
    const r: Matrix = [[phase(-4 * Math.PI / 5), [0, 0]], [[0, 0], phase(3 * Math.PI / 5)]];
    return { s1: r, s2: matMul(matMul(f, r), f), f };
}

function matrixDiff(a: Matrix, b: Matrix): number {
    let max = 0;
    for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < 2; j += 1) {
            max = Math.max(max, Math.hypot(a[i][j][0] - b[i][j][0], a[i][j][1] - b[i][j][1]));
        }
    }
    return max;
}

function apply(m: Matrix, v: [Complex, Complex]): [Complex, Complex] {
    return [add(mul(m[0][0], v[0]), mul(m[0][1], v[1])), add(mul(m[1][0], v[0]), mul(m[1][1], v[1]))];
}

function toPairs(flat: number[]): Array<[number, number]> {
    return Array.from({ length: flat.length / 2 }, (_, i) => [flat[2 * i] ?? 0, flat[2 * i + 1] ?? 0]);
}

function checkFrames(frames: VisualFrame[], wordLength: number): void {
    expect(frames.length).toBe(wordLength + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const norm = frame.meta["norm"] as number;
        expect(norm).toBeCloseTo(1, 10);
    });
}

describe("TopologicalQuantumComputing", () => {
    it("satisfies the Yang-Baxter relation and has unitary generators", () => {
        const { s1, s2 } = generators();
        expect(matrixDiff(matMul(matMul(s1, s2), s1), matMul(matMul(s2, s1), s2))).toBeLessThan(1e-12);
        const conjugate: Matrix = [
            [[s1[0][0][0], -s1[0][0][1]], [s1[1][0][0], -s1[1][0][1]]],
            [[s1[0][1][0], -s1[0][1][1]], [s1[1][1][0], -s1[1][1][1]]],
        ];
        expect(matrixDiff(matMul(conjugate, s1), [[[1, 0], [0, 0]], [[0, 0], [1, 0]]])).toBeLessThan(1e-12);
        let p1: Matrix = s1;
        let p2: Matrix = s2;
        for (let i = 1; i < 10; i += 1) {
            p1 = matMul(p1, s1);
            p2 = matMul(p2, s2);
        }
        expect(matrixDiff(p1, [[[1, 0], [0, 0]], [[0, 0], [1, 0]]])).toBeLessThan(1e-10);
        expect(matrixDiff(p2, [[[1, 0], [0, 0]], [[0, 0], [1, 0]]])).toBeLessThan(1e-10);
    });

    it("matches an independent sequential braid computation", () => {
        const { s1, s2 } = generators();
        for (const word of [[1, 2, 1, 2], [1], [2], [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [2, 1, 2, 2, 1]]) {
            const frames = [...mod.run({ braidWord: word })];
            checkFrames(frames, word.length);
            let state: [Complex, Complex] = [[1, 0], [0, 0]];
            for (const generator of word) state = apply(generator === 1 ? s1 : s2, state);
            const meta = frames[frames.length - 1]?.meta;
            const amplitudes = toPairs(meta?.["amplitudes"] as number[]);
            for (let i = 0; i < 2; i += 1) {
                expect(amplitudes[i]?.[0]).toBeCloseTo(state[i]?.[0] ?? 0, 10);
                expect(amplitudes[i]?.[1]).toBeCloseTo(state[i]?.[1] ?? 0, 10);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
