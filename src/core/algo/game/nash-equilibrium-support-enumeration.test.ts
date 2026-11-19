/**
 * nash-equilibrium-support-enumeration.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./nash-equilibrium-support-enumeration";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(cols);
    });
}

interface Input {
    A: number[][];
    B: number[][];
}

function resultOf(input: Input) {
    const frames = [...mod.run(input)];
    checkFrames(frames, input.A.length, (input.A[0] as number[]).length);
    const meta = frames[frames.length - 1]?.meta ?? {};
    return {
        found: meta["found"] as number,
        p: meta["equilibriumRows"] as number[],
        q: meta["equilibriumCols"] as number[],
        tested: meta["tested"] as number,
    };
}

function rowPayoff(A: number[][], i: number, q: number[]): number {
    return (A[i] as number[]).reduce((sum, value, j) => sum + value * (q[j] ?? 0), 0);
}

function colPayoff(B: number[][], j: number, p: number[]): number {
    return p.reduce((sum, value, i) => sum + value * ((B[i] as number[])[j] ?? 0), 0);
}

describe("Nash Equilibrium by Support Enumeration", () => {
    it("finds the fifty-fifty equilibrium of matching pennies", () => {
        const input = mod.defaultInput as Input;
        const got = resultOf(input);
        expect(got.found).toBeGreaterThanOrEqual(1);
        expect(got.p.length).toBe(2);
        expect(got.q.length).toBe(2);
        expect(got.p[0]).toBeCloseTo(0.5, 5);
        expect(got.p[1]).toBeCloseTo(0.5, 5);
        expect(got.q[0]).toBeCloseTo(0.5, 5);
        expect(got.q[1]).toBeCloseTo(0.5, 5);
    });

    it("finds the defect-defect equilibrium of the prisoner's dilemma", () => {
        const input: Input = {
            A: [
                [3, 0],
                [5, 1],
            ],
            B: [
                [3, 5],
                [0, 1],
            ],
        };
        const got = resultOf(input);
        expect(got.found).toBeGreaterThanOrEqual(1);
        expect(got.p[0]).toBeCloseTo(0, 5);
        expect(got.p[1]).toBeCloseTo(1, 5);
        expect(got.q[0]).toBeCloseTo(0, 5);
        expect(got.q[1]).toBeCloseTo(1, 5);
    });

    it("reported strategies have no profitable pure deviation", () => {
        const games: Input[] = [
            mod.defaultInput as Input,
            {
                A: [
                    [3, 0],
                    [5, 1],
                ],
                B: [
                    [3, 5],
                    [0, 1],
                ],
            },
            {
                A: [
                    [1, 0],
                    [0, 1],
                ],
                B: [
                    [1, 0],
                    [0, 1],
                ],
            },
        ];
        for (const game of games) {
            const got = resultOf(game);
            expect(got.found).toBeGreaterThanOrEqual(1);
            expect(got.p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
            expect(got.q.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
            const achievedRow = got.p.reduce((sum, v, i) => sum + v * rowPayoff(game.A, i, got.q), 0);
            const achievedCol = got.q.reduce((sum, v, j) => sum + v * colPayoff(game.B, j, got.p), 0);
            for (let i = 0; i < game.A.length; i += 1) {
                expect(rowPayoff(game.A, i, got.q)).toBeLessThanOrEqual(achievedRow + 1e-5);
            }
            const cols = (game.A[0] as number[]).length;
            for (let j = 0; j < cols; j += 1) {
                expect(colPayoff(game.B, j, got.p)).toBeLessThanOrEqual(achievedCol + 1e-5);
            }
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
