/** graph-convolution-network.test.ts - Reference layer computation, symmetry property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./graph-convolution-network";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    adjacency: Matrix;
    features: Matrix;
    weights: Matrix;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function parseRows(rows: string[]): Matrix {
    return rows.map((row) => row.split(",").map(Number));
}

function mul(a: Matrix, b: Matrix): Matrix {
    const rows = a.length;
    const inner = b.length;
    const cols = b[0]?.length ?? 0;
    const out: Matrix = [];
    for (let i = 0; i < rows; i += 1) {
        const row: number[] = [];
        for (let j = 0; j < cols; j += 1) {
            let sum = 0;
            for (let k = 0; k < inner; k += 1) sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
            row.push(sum);
        }
        out.push(row);
    }
    return out;
}

function reference(input: Input) {
    const withLoops = input.adjacency.map((row, i) => row.map((v, j) => v + (i === j ? 1 : 0)));
    const deg = withLoops.map((row) => row.reduce((a, v) => a + v, 0));
    const norm = withLoops.map((row, i) =>
        row.map((v, j) => v / (Math.sqrt(deg[i] ?? 1) * Math.sqrt(deg[j] ?? 1))),
    );
    const agg = mul(norm, input.features);
    const z = mul(agg, input.weights);
    const outputs = z.map((row) => row.map((v) => Math.max(0, v)));
    return { norm, outputs };
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

describe("Graph Convolutional Network", () => {
    it("matches an independent matrix-based GCN layer", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const outputs = parseRows(final?.["outputs"] as string[]);
        outputs.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected.outputs[i]![j]!)).toBe(true)));
    });

    it("produces a symmetric normalized adjacency", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const norm = parseRows(frames[2]?.meta["norm"] as string[]);
        for (let i = 0; i < norm.length; i += 1) {
            for (let j = 0; j < (norm[i]?.length ?? 0); j += 1) {
                expect(close(norm[i]![j]!, norm[j]![i]!)).toBe(true);
            }
        }
    });

    it("keeps ReLU outputs nonnegative", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const outputs = parseRows(frames[frames.length - 1]?.meta["outputs"] as string[]);
        expect(outputs.every((row) => row.every((v) => v >= 0))).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
