/** graph-sage.test.ts - Reference aggregation, neighbor-mean property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./graph-sage";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    adjacency: Matrix;
    features: number[];
    selfWeight: number;
    neighborWeight: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function reference(input: Input) {
    const n = input.adjacency.length;
    const means: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const neighbors: number[] = [];
        for (let j = 0; j < n; j += 1) {
            if (j !== i && (input.adjacency[i]?.[j] ?? 0) > 0) neighbors.push(j);
        }
        means.push(neighbors.length === 0 ? 0
            : neighbors.reduce((a, j) => a + (input.features[j] ?? 0), 0) / neighbors.length);
    }
    const outputs = input.features.map((h, i) =>
        Math.max(0, input.selfWeight * h + input.neighborWeight * means[i]!));
    return { means, outputs };
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

describe("GraphSAGE", () => {
    it("matches an independent mean-aggregation computation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["means"]).toEqual(expected.means);
        const outputs = final?.["outputs"] as number[];
        outputs.forEach((v, i) => expect(close(v, expected.outputs[i]!)).toBe(true));
    });

    it("gives isolated nodes a zero neighbor message", () => {
        const input: Input = {
            adjacency: [[0, 0], [0, 0]],
            features: [1, 2],
            selfWeight: 1,
            neighborWeight: 1,
        };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["means"]).toEqual([0, 0]);
        expect(final?.["outputs"]).toEqual([1, 2]);
    });

    it("keeps the neighbor mean between min and max neighbor feature", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const input = mod.defaultInput as Input;
        const means = frames[frames.length - 1]?.meta["means"] as number[];
        for (let i = 0; i < input.adjacency.length; i += 1) {
            const neigh: number[] = [];
            for (let j = 0; j < input.adjacency.length; j += 1) {
                if (j !== i && (input.adjacency[i]?.[j] ?? 0) > 0) neigh.push(input.features[j]!);
            }
            expect(means[i]!).toBeGreaterThanOrEqual(Math.min(...neigh));
            expect(means[i]!).toBeLessThanOrEqual(Math.max(...neigh));
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
