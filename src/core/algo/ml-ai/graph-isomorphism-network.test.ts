/** graph-isomorphism-network.test.ts - Independent GIN reference, permutation equivariance, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./graph-isomorphism-network";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    adjacency: Record<string, string[]>;
    features: Matrix;
    eps: number;
    w1: Matrix;
    b1: number[];
    w2: Matrix;
    b2: number[];
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
const relu = (v: number): number => (v > 0 ? v : 0);

/** Independent reference for one GIN layer. */
function reference(input: Input): Matrix {
    const ids = Object.keys(input.adjacency);
    return input.features.map((row, i) => {
        const summed = new Array(row.length).fill(0);
        for (const neighbor of input.adjacency[ids[i] ?? ""] ?? []) {
            const j = ids.indexOf(neighbor);
            if (j < 0) continue;
            for (let k = 0; k < row.length; k += 1) summed[k] = (summed[k] ?? 0) + (input.features[j]?.[k] ?? 0);
        }
        const agg = row.map((v, k) => (1 + input.eps) * v + (summed[k] ?? 0));
        const hidden = input.w1.map((r, h) => relu(dot(agg, r) + (input.b1[h] ?? 0)));
        return input.w2.map((r, h) => relu(dot(hidden, r) + (input.b2[h] ?? 0)));
    });
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

describe("Graph Isomorphism Network", () => {
    it("matches an independent reference on the default input", () => {
        const base = mod.defaultInput as Omit<Input, "w1" | "b1" | "w2" | "b2">;
        const input: Input = {
            ...base,
            w1: [
                [1, 0.5],
                [-0.5, 1],
            ],
            b1: [0, 0],
            w2: [
                [0.5, 0],
                [0, 0.5],
            ],
            b2: [0, 0],
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const actual = frames[frames.length - 1]?.meta["output"] as Matrix;
        actual.forEach((row, i) => row.forEach((v, k) => expect(close(v, expected[i]![k]!)).toBe(true)));
    });

    it("is equivariant to a relabeling of the nodes", () => {
        const base = mod.defaultInput as Omit<Input, "w1" | "b1" | "w2" | "b2">;
        const extra = {
            w1: [
                [1, 0.5],
                [-0.5, 1],
            ],
            b1: [0, 0],
            w2: [
                [0.5, 0],
                [0, 0.5],
            ],
            b2: [0, 0],
        };
        const input: Input = { ...base, ...extra };
        const original = reference(input);
        const ids = Object.keys(base.adjacency);
        const perm = [2, 0, 3, 1];
        const relabeledAdj: Record<string, string[]> = {};
        for (const old of perm) {
            const id = ids[old]!;
            relabeledAdj[id] = (base.adjacency[id] ?? []).slice();
        }
        const relabeled: Input = {
            ...input,
            adjacency: relabeledAdj,
            features: perm.map((old) => base.features[old]!),
        };
        const frames = [...mod.run(relabeled)];
        const actual = frames[frames.length - 1]?.meta["output"] as Matrix;
        for (let p = 0; p < perm.length; p += 1) {
            actual[p]!.forEach((v, k) => expect(close(v, original[perm[p]!]![k]!)).toBe(true));
        }
    });

    it("gives an isolated node only its scaled self feature", () => {
        const input: Input = {
            adjacency: { A: [], B: [] },
            features: [
                [2, -1],
                [0.5, 3],
            ],
            eps: 0.25,
            w1: [
                [1, 0],
                [0, 1],
            ],
            b1: [0, 0],
            w2: [
                [1, 0],
                [0, 1],
            ],
            b2: [0, 0],
        };
        const expected = reference(input);
        const frames = [...mod.run(input)];
        const actual = frames[frames.length - 1]?.meta["output"] as Matrix;
        actual[0]!.forEach((v, k) => expect(close(v, expected[0]![k]!)).toBe(true));
        expect(close(actual[0]![0]!, 2.5)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
