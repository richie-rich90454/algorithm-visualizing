/**
 * flashinfer.test.ts - Online softmax correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./flashinfer";
import type { VisualFrame } from "@/types";

/** Ordinary softmax attention computed in one shot. */
function reference(query: number, keys: number[], values: number[]): number {
    const scores = keys.map((k) => query * k);
    const max = Math.max(...scores);
    const weights = scores.map((s) => Math.exp(s - max));
    const total = weights.reduce((sum, w) => sum + w, 0);
    return weights.reduce((sum, w, i) => sum + w * (values[i] ?? 0), 0) / total;
}

function checkFrames(frames: VisualFrame[], tokens: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(tokens);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["row"] === "number")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("FlashInfer paged attention core", () => {
    it("matches one-shot softmax attention", () => {
        const input = mod.defaultInput as { query: number; keys: number[]; values: number[]; pageSize: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.keys.length);
        const final = frames[frames.length - 1]?.meta["output"];
        expect(final).toBeCloseTo(reference(input.query, input.keys, input.values), 9);
        expect(frames[frames.length - 1]?.meta["denom"]).toBeGreaterThan(0);
    });

    it("agrees with the reference on several random small cases", () => {
        const cases = [
            { query: 0, keys: [1, 2, 3], values: [4, 5, 6] },
            { query: -1, keys: [2, 5], values: [1, 3] },
            { query: 3, keys: [1, 1, 1, 1], values: [2, 4, 6, 8] },
        ];
        for (const input of cases) {
            const frames = [...mod.run({ ...input, pageSize: 2 })];
            const final = frames[frames.length - 1]?.meta["output"];
            expect(final).toBeCloseTo(reference(input.query, input.keys, input.values), 9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
