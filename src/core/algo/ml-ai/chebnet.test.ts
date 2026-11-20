/** chebnet.test.ts - Independent spectral reference, Chebyshev recurrence, permutation equivariance, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { multiply } from "./chebnet";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    adjacency: Matrix;
    features: Matrix;
    weights: Matrix[];
    k: number;
    lambdaMax: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function identity(n: number): Matrix {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

/** Independent reference computing T_k by repeated matrix multiplication. */
function reference(input: Input) {
    const n = input.adjacency.length;
    const degree = input.adjacency.map((row) => row.reduce((a, b) => a + b, 0));
    const L = identity(n).map((_row, i) =>
        Array.from({ length: n }, (_, j) => {
            const scaled = (input.adjacency[i]?.[j] ?? 0) / (Math.sqrt(degree[i] || 1) * Math.sqrt(degree[j] || 1));
            return (i === j ? 1 : 0) - scaled;
        }),
    );
    const Ltilde = L.map((row, i) => row.map((v, j) => (2 * v) / input.lambdaMax - (i === j ? 1 : 0)));
    const polys: Matrix[] = [identity(n)];
    if (input.k > 1) polys.push(Ltilde);
    for (let order = 2; order < input.k; order += 1) {
        const term = multiply(Ltilde, polys[order - 1]!);
        polys.push(term.map((row, i) => row.map((v, j) => 2 * v - (polys[order - 2]![i]![j] ?? 0))));
    }
    const outCols = input.weights[0]?.[0]?.length ?? 0;
    let total: Matrix = Array.from({ length: n }, () => new Array(outCols).fill(0));
    for (let order = 0; order < input.k; order += 1) {
        const term = multiply(multiply(polys[order]!, input.features), input.weights[order]!);
        total = total.map((row, i) => row.map((v, j) => v + (term[i]?.[j] ?? 0)));
    }
    return { Ltilde, polys, output: total };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ChebNet spectral convolution", () => {
    it("matches an independent spectral reference on the default input", () => {
        const base = mod.defaultInput as Omit<Input, "weights" | "lambdaMax">;
        const input: Input = {
            ...base,
            lambdaMax: 2,
            weights: [
                [
                    [1, 0],
                    [0, 1],
                ],
                [
                    [0.5, 0],
                    [0, 0.5],
                ],
                [
                    [0, 0.2],
                    [0.2, 0],
                ],
            ],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const actual = frames[frames.length - 1]?.meta["output"] as Matrix;
        actual.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected.output[i]![j]!)).toBe(true)));
    });

    it("satisfies the Chebyshev three-term recurrence", () => {
        const input = mod.defaultInput as Omit<Input, "weights" | "lambdaMax">;
        const weights: Matrix[] = [
            [
                [1, 0],
                [0, 1],
            ],
            [
                [0.5, 0],
                [0, 0.5],
            ],
            [
                [0, 0.2],
                [0.2, 0],
            ],
        ];
        const frames = [...mod.run({ ...input, weights, lambdaMax: 2 })];
        const polys = frames[frames.length - 1]?.meta["polynomials"] as Matrix[];
        const Ltilde = frames[frames.length - 1]?.meta["Ltilde"] as Matrix;
        const t2 = polys[2]!;
        const twice = multiply(Ltilde, Ltilde).map((row) => row.map((v) => 2 * v));
        t2.forEach((row, i) => row.forEach((v, j) => expect(close(v, (twice[i]![j] ?? 0) - (i === j ? 1 : 0))).toBe(true)));
    });

    it("is equivariant to node relabeling", () => {
        const base = mod.defaultInput as Omit<Input, "weights" | "lambdaMax">;
        const weights: Matrix[] = [
            [
                [1, 0],
                [0, 1],
            ],
            [
                [0.5, 0],
                [0, 0.5],
            ],
            [
                [0, 0.2],
                [0.2, 0],
            ],
        ];
        const input: Input = { ...base, weights, lambdaMax: 2 };
        const original = reference(input).output;
        const n = base.adjacency.length;
        const perm = [2, 0, 1];
        const A2 = Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => base.adjacency[perm[i]!]![perm[j]!]!),
        );
        const X2 = perm.map((old) => base.features[old]!.slice());
        const relabeled: Input = { ...input, adjacency: A2, features: X2 };
        const frames = [...mod.run(relabeled)];
        const actual = frames[frames.length - 1]?.meta["output"] as Matrix;
        for (let i = 0; i < n; i += 1) {
            actual[i]!.forEach((v, j) => expect(close(v, original[perm[i]!]![j]!)).toBe(true));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(1 + (mod.defaultInput as Input).k + 1);
        expect(generator.next().done).toBe(true);
    });
});
