/**
 * markov-chain-stationary-distribution.test.ts - Independent linear solve,
 * invariant checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./markov-chain-stationary-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const dist = frame.meta["distribution"] as number[];
        expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
    });
}

/** Solve pi times P equals pi with a sum-to-one constraint via Gaussian elimination. */
function solveStationary(P: number[][]): number[] {
    const n = P.length;
    const A: number[][] = Array.from({ length: n }, (_, j) =>
        Array.from({ length: n + 1 }, (_, i) => {
            if (j === 0) {
                return i === n ? 1 : 1;
            }
            if (i === n) {
                return 0;
            }
            return (P[i]?.[j] ?? 0) - (i === j ? 1 : 0);
        }),
    );
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(A[r]![col]!) > Math.abs(A[pivot]![col]!)) {
                pivot = r;
            }
        }
        const temp = A[col]!;
        A[col] = A[pivot]!;
        A[pivot] = temp;
        const div = A[col]![col]!;
        for (let c = col; c <= n; c += 1) {
            A[col]![c]! /= div;
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) {
                continue;
            }
            const factor = A[r]![col]!;
            for (let c = col; c <= n; c += 1) {
                A[r]![c]! -= factor * A[col]![c]!;
            }
        }
    }
    return A.map((row) => row[n]!);
}

describe("MarkovChainStationaryDistribution", () => {
    it("converges to a solution of the stationary linear system", () => {
        const chains: number[][][] = [
            [[0.9, 0.1], [0.2, 0.8]],
            [[0.5, 0.5], [0.25, 0.75]],
            [[0.7, 0.2, 0.1], [0.1, 0.8, 0.1], [0.2, 0.3, 0.5]],
            [[0.1, 0.9], [0.8, 0.2]],
        ];
        for (const P of chains) {
            const frames = [...mod.run({ transition: P, iterations: 200 })];
            checkFrames(frames, P.length);
            const result = frames[frames.length - 1]?.meta["distribution"] as number[];
            const expected = solveStationary(P);
            for (let i = 0; i < P.length; i += 1) {
                expect(result[i]).toBeCloseTo(expected[i]!, 6);
            }
        }
    });

    it("matches the known two-state equilibrium", () => {
        const frames = [...mod.run({ transition: [[0.9, 0.1], [0.2, 0.8]], iterations: 60 })];
        checkFrames(frames, 2);
        const result = frames[frames.length - 1]?.meta["distribution"] as number[];
        expect(result[0]).toBeCloseTo(2 / 3, 6);
        expect(result[1]).toBeCloseTo(1 / 3, 6);
    });

    it("drives the residual toward zero", () => {
        const frames = [...mod.run({ transition: [[0.5, 0.5], [0.25, 0.75]], iterations: 80 })];
        checkFrames(frames, 2);
        const early = Number(frames[1]?.meta["residual"]);
        const late = Number(frames[frames.length - 2]?.meta["residual"]);
        expect(late).toBeLessThan(early);
        expect(late).toBeLessThan(1e-6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(22);
        expect(generator.next().done).toBe(true);
    });
});
