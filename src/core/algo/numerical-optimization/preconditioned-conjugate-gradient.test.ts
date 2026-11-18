/**
 * preconditioned-conjugate-gradient.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./preconditioned-conjugate-gradient";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

/** Brute-force 2x2 system solve, independent of the module. */
function solve2(A: number[][], b: number[]): [number, number] {
    const det = A[0]![0]! * A[1]![1]! - A[0]![1]! * A[1]![0]!;
    return [
        (A[1]![1]! * b[0]! - A[0]![1]! * b[1]!) / det,
        (-A[1]![0]! * b[0]! + A[0]![0]! * b[1]!) / det,
    ];
}

describe("Preconditioned conjugate gradient", () => {
    it("solves the default system to the brute-force answer", () => {
        const input = mod.defaultInput as { A: number[][]; b: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        const [x1, x2] = solve2(input.A, input.b);
        const metaFrame = finalMeta(frames);
        const x = metaFrame["x"] as number[];
        expect(metaFrame["converged"]).toBe(true);
        expect(x[0]).toBeCloseTo(x1, 6);
        expect(x[1]).toBeCloseTo(x2, 6);
        expect(metaFrame["residual"] as number).toBeLessThan(1e-9);
    });

    it("solves a three-dimensional SPD system", () => {
        const A = [
            [6, 2, 1],
            [2, 5, -1],
            [1, -1, 4],
        ];
        const b = [1, 2, 3];
        const MInv = [1 / 6, 1 / 5, 1 / 4];
        const frames = [...mod.run({ A, b, MInv, iterations: 100, tolerance: 1e-12 })];
        checkFrames(frames, 3);
        const metaFrame = finalMeta(frames);
        const x = metaFrame["x"] as number[];
        // Verify A x equals b directly instead of trusting a solve.
        for (let row = 0; row < 3; row += 1) {
            let sum = 0;
            for (let col = 0; col < 3; col += 1) {
                sum += A[row]![col]! * x[col]!;
            }
            expect(sum).toBeCloseTo(b[row]!, 6);
        }
        expect(metaFrame["converged"]).toBe(true);
    });

    it("terminates cleanly and reports a small residual", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(finalMeta([...mod.run(mod.defaultInput)])["residual"] as number).toBeLessThan(1e-9);
        expect(generator.next().done).toBe(true);
    });
});
