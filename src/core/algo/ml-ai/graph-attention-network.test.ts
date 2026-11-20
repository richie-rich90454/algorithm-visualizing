/** graph-attention-network.test.ts - Reference attention, normalization property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./graph-attention-network";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    adjacency: Matrix;
    features: number[];
    weight: number;
    aSelf: number;
    aNeighbor: number;
    leaky: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function parseRows(rows: string[]): Matrix {
    return rows.map((row) => row.split(",").map(Number));
}

function softmax(values: number[]): number[] {
    const max = Math.max(...values);
    const exps = values.map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, v) => a + v, 0);
    return exps.map((v) => v / sum);
}

function reference(input: Input) {
    const n = input.adjacency.length;
    const alphas: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const outputs: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const neighbors = [i];
        for (let j = 0; j < n; j += 1) {
            if (j !== i && (input.adjacency[i]?.[j] ?? 0) > 0) neighbors.push(j);
        }
        const raw = neighbors.map((j) => {
            const s = input.aSelf * input.weight * (input.features[i] ?? 0)
                + input.aNeighbor * input.weight * (input.features[j] ?? 0);
            return s >= 0 ? s : input.leaky * s;
        });
        const norm = softmax(raw);
        neighbors.forEach((j, k) => { alphas[i]![j] = norm[k]!; });
        let sum = 0;
        for (let j = 0; j < n; j += 1) sum += alphas[i]![j]! * input.weight * (input.features[j] ?? 0);
        outputs.push(Math.max(0, sum));
    }
    return { alphas, outputs };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.every((e) => e.directed)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Graph Attention Network", () => {
    it("matches an independent attention computation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const outputs = final?.["outputs"] as number[];
        outputs.forEach((v, i) => expect(close(v, expected.outputs[i]!)).toBe(true));
    });

    it("attention weights over each neighborhood sum to one", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const alphas = parseRows(frames[frames.length - 1]?.meta["alphas"] as string[]);
        const n = input.adjacency.length;
        for (let i = 0; i < n; i += 1) {
            let sum = alphas[i]![i]!;
            for (let j = 0; j < n; j += 1) if (j !== i && (input.adjacency[i]?.[j] ?? 0) > 0) sum += alphas[i]![j]!;
            expect(close(sum, 1)).toBe(true);
        }
    });

    it("keeps embeddings nonnegative", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const outputs = frames[frames.length - 1]?.meta["outputs"] as number[];
        expect(outputs.every((v) => v >= 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
