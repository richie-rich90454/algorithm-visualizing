/** monarch-mixer.test.ts - Dense reconstruction check, block-locality, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { monarchMatvec } from "./monarch-mixer";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    x: number[];
    p: number;
    q: number;
    leftBlocks: Matrix[];
    rightBlocks: Matrix[];
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

/** Reconstruct the dense matrix column by column using unit-vector inputs. */
function denseMatrix(input: Input): Matrix {
    const n = input.p * input.q;
    const columns: number[][] = [];
    for (let k = 0; k < n; k += 1) {
        const e = new Array(n).fill(0);
        e[k] = 1;
        columns.push(monarchMatvec(e, input.leftBlocks, input.rightBlocks, input.p, input.q));
    }
    const M: Matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) M[r]![c] = columns[c]![r]!;
    return M;
}

function matVec(M: Matrix, x: number[]): number[] {
    return M.map((row) => row.reduce((sum, v, j) => sum + v * (x[j] ?? 0), 0));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Monarch mixer", () => {
    it("the factored matvec equals multiplication by the reconstructed dense matrix", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = matVec(denseMatrix(input), input.x);
        const actual = frames[frames.length - 1]?.meta["output"] as number[];
        actual.forEach((v, i) => expect(close(v, expected[i]!)).toBe(true));
    });

    it("matches the dense product on several random vectors", () => {
        const input = mod.defaultInput as Input;
        const M = denseMatrix(input);
        const vectors = [
            [1, 2, 3, 4],
            [-1, 0.5, 2, -3],
            [0, 0, 0, 0],
            [7, -2, 1, 5],
        ];
        for (const x of vectors) {
            const expected = matVec(M, x);
            const actual = monarchMatvec(x, input.leftBlocks, input.rightBlocks, input.p, input.q);
            actual.forEach((v, i) => expect(close(v, expected[i]!)).toBe(true));
        }
    });

    it("reconstructs a nontrivial dense matrix from a different block set", () => {
        const input: Input = {
            x: [2, -1, 3, 1],
            p: 2,
            q: 2,
            leftBlocks: [
                [
                    [2, 0],
                    [1, -1],
                ],
                [
                    [3, 1],
                    [0, 2],
                ],
            ],
            rightBlocks: [
                [
                    [1, 2],
                    [0, 1],
                ],
                [
                    [-1, 0],
                    [2, 3],
                ],
            ],
        };
        const M = denseMatrix(input);
        expect(M.some((row, i) => row.some((v, j) => !close(v, i === j ? 1 : 0)))).toBe(true);
        const expected = matVec(M, input.x);
        const frames = [...mod.run(input)];
        const actual = frames[frames.length - 1]?.meta["output"] as number[];
        actual.forEach((v, i) => expect(close(v, expected[i]!)).toBe(true));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
