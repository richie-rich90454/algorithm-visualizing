/**
 * gauss-jordan-elimination.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gauss-jordan-elimination";
import type { VisualFrame } from "@/types";

/** Cramer's rule oracle for a 3 by 3 system. */
function cramer(matrix: number[][], rhs: number[]): number[] {
    const det3 = (m: number[][]) =>
        m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
        m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
        m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
    const base = det3(matrix);
    return [0, 1, 2].map((col) => {
        const replaced = matrix.map((row, r) =>
            row.map((value, c) => (c === col ? rhs[r]! : value)),
        );
        return det3(replaced) / base;
    });
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * (n + 1));
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n + 1);
    });
}

describe("Gauss-Jordan Elimination", () => {
    it("solves a system and matches an independent Cramer's rule oracle", () => {
        const input = mod.defaultInput as { matrix: number[][]; rhs: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.matrix.length);
        const last = frames[frames.length - 1]?.meta;
        const solution = last?.["solution"] as number[];
        expect(solution).toHaveLength(3);
        expect(solution[0]).toBeCloseTo(2, 6);
        expect(solution[1]).toBeCloseTo(3, 6);
        expect(solution[2]).toBeCloseTo(-1, 6);
        const expected = cramer(input.matrix, input.rhs);
        for (let i = 0; i < expected.length; i += 1) {
            expect(solution[i]).toBeCloseTo(expected[i] as number, 6);
        }
    });

    it("produces a solution that satisfies every original equation", () => {
        const input = mod.defaultInput as { matrix: number[][]; rhs: number[] };
        const frames = [...mod.run(input)];
        const solution = frames[frames.length - 1]?.meta["solution"] as number[];
        for (let row = 0; row < input.matrix.length; row += 1) {
            let sum = 0;
            for (let col = 0; col < solution.length; col += 1) {
                sum += (input.matrix[row]?.[col] ?? 0) * (solution[col] as number);
            }
            expect(sum).toBeCloseTo(input.rhs[row] as number, 6);
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
