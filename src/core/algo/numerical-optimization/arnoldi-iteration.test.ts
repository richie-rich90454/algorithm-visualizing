/**
 * arnoldi-iteration.test.ts - Arnoldi relation, orthogonality, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { arnoldi } from "./arnoldi-iteration";
import type { VisualFrame } from "@/types";

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

function matVec(a: number[][], x: number[]): number[] {
    return a.map((row) => dot(row, x));
}

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

describe("Arnoldi Iteration", () => {
    it("satisfies the Arnoldi relation and orthonormal basis on random matrices", () => {
        let seed = 99;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const n = 5;
            const matrix = Array.from({ length: n }, () =>
                Array.from({ length: n }, () => (rand() % 11) - 5),
            );
            const q1 = Array.from({ length: n }, () => (rand() % 9) - 4);
            const result = arnoldi(matrix, q1, 4);
            expect(result.orthError).toBeLessThan(1e-9);
            expect(result.residual).toBeLessThan(1e-9);
            for (const vector of result.q) {
                expect(dot(vector, vector)).toBeCloseTo(1, 9);
            }
            for (let i = 0; i < result.q.length; i += 1) {
                for (let j = i + 1; j < result.q.length; j += 1) {
                    expect(dot(result.q[i]!, result.q[j]!)).toBeCloseTo(0, 9);
                }
            }
        }
    });

    it("reproduces direct matrix action for a full basis", () => {
        const a = [[4, 1, 0], [1, 3, 1], [0, 1, 2]];
        const q1 = [1, 0, 0];
        const result = arnoldi(a, q1, 3);
        expect(result.q.length).toBe(3);
        expect(Math.sqrt(dot(result.q[0]!, result.q[0]!))).toBeCloseTo(1, 10);
        // For a full n-step factorization the action is exactly represented.
        const aq0 = matVec(a, result.q[0]!);
        const represented = Array<number>(3).fill(0);
        for (let i = 0; i < result.q.length; i += 1) {
            const coefficient = result.h[i]![0] ?? 0;
            for (let row = 0; row < 3; row += 1) {
                represented[row] = (represented[row] ?? 0) + coefficient * (result.q[i]![row] ?? 0);
            }
        }
        for (let row = 0; row < 3; row += 1) {
            expect(represented[row]).toBeCloseTo(aq0[row]!, 9);
        }
    });

    it("produces well-formed frames on the default input", () => {
        const input = mod.defaultInput as { matrix: number[][]; q1: number[]; steps: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.q1.length);
        expect(Number(frames[frames.length - 1]?.meta["residual"])).toBeLessThan(1e-9);
        expect(Number(frames[frames.length - 1]?.meta["orthError"])).toBeLessThan(1e-9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
