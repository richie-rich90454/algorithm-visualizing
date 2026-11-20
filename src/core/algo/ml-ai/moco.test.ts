/** moco.test.ts - InfoNCE, FIFO queue, and EMA encoder correctness. */
import { describe, expect, it } from "vitest";
import mod from "./moco";
import type { VisualFrame } from "@/types";

interface Input {
    queryWeights: number[];
    keyWeights: number[];
    queryInput: number[];
    keyInput: number[];
    queue: number[];
    temperature: number;
    momentum: number;
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

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
}

function logSumExp(values: number[]): number {
    const max = Math.max(...values);
    return max + Math.log(values.reduce((sum, v) => sum + Math.exp(v - max), 0));
}

function reference(input: Input) {
    const query = dot(input.queryWeights, input.queryInput);
    const positiveKey = dot(input.keyWeights, input.keyInput);
    const pos = (query * positiveKey) / input.temperature;
    const negs = input.queue.map((key) => (query * key) / input.temperature);
    const loss = logSumExp([pos, ...negs]) - pos;
    const newQueue = [...input.queue.slice(1), positiveKey];
    const newWeights = input.keyWeights.map((w, i) => input.momentum * w + (1 - input.momentum) * input.queryWeights[i]!);
    return { query, positiveKey, pos, negs, loss, newQueue, newWeights };
}

describe("Momentum Contrast", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent InfoNCE and encoder-replay computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]!.meta;
        const logitFrame = frames.find((f) => f.meta["query"] !== undefined)!.meta;
        expect(Number(final["loss"])).toBeCloseTo(expected.loss, 10);
        expect(Number(logitFrame["query"])).toBeCloseTo(expected.query, 10);
        expect(Number(logitFrame["positiveKey"])).toBeCloseTo(expected.positiveKey, 10);
        expect(Number(logitFrame["posLogit"])).toBeCloseTo(expected.pos, 10);
        (final["queue"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.newQueue[i]!, 10));
        (final["keyWeights"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.newWeights[i]!, 10));
    });

    it("evicts exactly the oldest queued negative", () => {
        const frames = [...mod.run(input)];
        const queueFrame = frames.find((f) => f.meta["previousQueue"] !== undefined);
        expect(queueFrame).toBeDefined();
        const before = queueFrame!.meta["previousQueue"] as number[];
        const after = queueFrame!.meta["queue"] as number[];
        expect(after.length).toBe(before.length);
        expect(after.slice(0, -1)).toEqual(before.slice(1));
        expect(after[after.length - 1]).toBeCloseTo(Number(queueFrame!.meta["enqueued"]), 10);
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
