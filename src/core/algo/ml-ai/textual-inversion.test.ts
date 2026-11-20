/** textual-inversion.test.ts - Gradient replay and least-squares convergence. */
import { describe, expect, it } from "vitest";
import mod from "./textual-inversion";
import type { VisualFrame } from "@/types";

interface Input {
    embedding: number[];
    target: number[];
    model: number[][];
    steps: number;
    learningRate: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("array");
        expect(frame.meta).toBeDefined();
    });
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, w, i) => sum + w * (vector[i] ?? 0), 0));
}

function matTransposeVec(matrix: number[][], vector: number[]): number[] {
    const cols = matrix[0]!.length;
    return Array.from({ length: cols }, (_, j) =>
        matrix.reduce((sum, row, i) => sum + row[j]! * vector[i]!, 0),
    );
}

function lossAt(e: number[], input: Input): number {
    const projected = matVec(input.model, e);
    return 0.5 * projected.reduce((sum, v, i) => sum + (v - input.target[i]!) ** 2, 0);
}

function replay(input: Input) {
    const e = [...input.embedding];
    const losses = [lossAt(e, input)];
    for (let t = 0; t < input.steps; t += 1) {
        const residual = matVec(input.model, e).map((v, i) => v - input.target[i]!);
        const grad = matTransposeVec(input.model, residual);
        e.forEach((v, i) => {
            e[i] = v - input.learningRate * grad[i]!;
        });
        losses.push(lossAt(e, input));
    }
    return { e, losses };
}

/** Solve the normal equations for a 2x2 model with Gaussian elimination. */
function leastSquares(input: Input): number[] {
    const [a, b] = input.model;
    const m00 = a![0]! ** 2 + b![0]! ** 2;
    const m01 = a![0]! * a![1]! + b![0]! * b![1]!;
    const m11 = a![1]! ** 2 + b![1]! ** 2;
    const rhs0 = a![0]! * input.target[0]! + b![0]! * input.target[1]!;
    const rhs1 = a![1]! * input.target[0]! + b![1]! * input.target[1]!;
    const det = m00 * m11 - m01 * m01;
    return [(rhs0 * m11 - rhs1 * m01) / det, (m00 * rhs1 - m01 * rhs0) / det];
}

describe("Textual Inversion", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent gradient replay", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = replay(input);
        const final = frames[frames.length - 1]!.meta;
        (final["embedding"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.e[i]!, 10));
        (final["losses"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.losses[i]!, 10));
    });

    it("lowers the loss monotonically and approaches the least-squares optimum", () => {
        const frames = [...mod.run({ ...input, steps: 400 })];
        const final = frames[frames.length - 1]!.meta;
        const losses = final["losses"] as number[];
        for (let i = 1; i < losses.length; i += 1) {
            expect(losses[i]!).toBeLessThanOrEqual(losses[i - 1]! + 1e-12);
        }
        const optimum = leastSquares(input);
        (final["embedding"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(optimum[i]!, 3));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
