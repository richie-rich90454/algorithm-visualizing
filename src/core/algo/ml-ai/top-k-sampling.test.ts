/** top-k-sampling.test.ts - Independent top-k reference, distribution properties, determinism, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { sample, topKDistribution, uniform } from "./top-k-sampling";
import type { VisualFrame } from "@/types";

interface Input {
    logits: number[];
    k: number;
    seed: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

/** Independent reference computing the top-k set and distribution with explicit sorting. */
function reference(logits: number[], k: number) {
    const limit = Math.max(1, Math.min(logits.length, Math.floor(k)));
    const order = logits.map((_, i) => i).sort((a, b) => logits[b]! - logits[a]! || a - b);
    const kept = order.slice(0, limit);
    const max = Math.max(...kept.map((i) => logits[i]!));
    const exps = logits.map((v, i) => (kept.includes(i) ? Math.exp(v - max) : 0));
    const total = exps.reduce((a, b) => a + b, 0);
    return { kept, probability: exps.map((v) => v / total) };
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

describe("Top-k sampling", () => {
    it("matches an independent reference on the default input", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.logits, input.k);
        const final = frames[frames.length - 1]?.meta;
        const kept = final?.["kept"] as number[];
        const probability = final?.["probability"] as number[];
        expect(new Set(kept)).toEqual(new Set(expected.kept));
        probability.forEach((v, i) => expect(close(v, expected.probability[i]!)).toBe(true));
    });

    it("gives zero mass outside the top k and sums to one", () => {
        const { probability } = topKDistribution([2, 1, 0.5, 0.1, -1, -2], 3);
        expect(close(probability.reduce((a, b) => a + b, 0), 1)).toBe(true);
        expect(probability[3]).toBe(0);
        expect(probability[4]).toBe(0);
        expect(probability[5]).toBe(0);
    });

    it("always samples within the kept set and is reproducible", () => {
        const logits = [3, 2, 1, 0, -1];
        const { probability, kept } = topKDistribution(logits, 2);
        for (let seed = 0; seed < 40; seed += 1) {
            const a = sample(probability, seed);
            const b = sample(probability, seed);
            expect(a).toBe(b);
            expect(kept.has(a)).toBe(true);
        }
        expect(uniform(7)).toBe(uniform(7));
        expect(uniform(7)).not.toBe(uniform(8));
    });

    it("handles k equal to the vocabulary size", () => {
        const logits = [1, 2, 3];
        const expected = reference(logits, 3);
        const { probability, kept } = topKDistribution(logits, 3);
        expect(kept.size).toBe(3);
        probability.forEach((v, i) => expect(close(v, expected.probability[i]!)).toBe(true));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
