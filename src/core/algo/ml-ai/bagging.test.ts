/** bagging.test.ts - Reference mean-of-means, single-replicate property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./bagging";
import type { VisualFrame } from "@/types";

interface Input {
    values: number[];
    samples: number[][];
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, v) => a + v, 0) / values.length;
}

function reference(input: Input) {
    const predictions = input.samples.map((sample) => mean(sample.map((i) => input.values[i] ?? 0)));
    return { predictions, aggregate: mean(predictions) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bagging", () => {
    it("matches an independent mean-of-means computation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["predictions"]).toEqual(expected.predictions);
        expect(close(final?.["aggregate"] as number, expected.aggregate)).toBe(true);
    });

    it("a single full-data replicate gives the plain data mean", () => {
        const frames = [...mod.run({ values: [2, 4, 6, 8], samples: [[0, 1, 2, 3]] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["predictions"]).toEqual([5]);
        expect(final?.["aggregate"]).toBe(5);
    });

    it("replicates with repeats are counted correctly", () => {
        const frames = [...mod.run({ values: [1, 10], samples: [[0, 0, 0], [1, 1]] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["predictions"]).toEqual([1, 10]);
        expect(final?.["aggregate"]).toBe(5.5);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
