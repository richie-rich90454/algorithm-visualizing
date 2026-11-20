/** message-passing-neural-network.test.ts - Reference aggregation, self-exclusion property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./message-passing-neural-network";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    adjacency: Matrix;
    features: number[];
    scale: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function reference(input: Input) {
    const n = input.adjacency.length;
    const messages = input.features.map((_, i) => {
        let sum = 0;
        for (let j = 0; j < n; j += 1) {
            if (j !== i && (input.adjacency[i]?.[j] ?? 0) > 0) sum += input.features[j] ?? 0;
        }
        return sum;
    });
    const outputs = input.features.map((h, i) => Math.max(0, h + input.scale * messages[i]!));
    return { messages, outputs };
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

describe("Message Passing Neural Network", () => {
    it("matches an independent sum-aggregation computation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["messages"]).toEqual(expected.messages);
        const outputs = final?.["outputs"] as number[];
        outputs.forEach((v, i) => expect(close(v, expected.outputs[i]!)).toBe(true));
    });

    it("never includes a node's own feature in its message", () => {
        const input: Input = { adjacency: [[0, 1], [1, 0]], features: [5, 7], scale: 1 };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["messages"]).toEqual([7, 5]);
        expect(final?.["outputs"]).toEqual([12, 12]);
    });

    it("keeps updated features nonnegative", () => {
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
