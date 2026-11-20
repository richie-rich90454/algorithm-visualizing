/** min-p-sampling.test.ts - Brute-force cutoff, distribution properties, determinism, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { minPDistribution, sample, softmax, uniform } from "./min-p-sampling";
import type { VisualFrame } from "@/types";

interface Input {
    logits: number[];
    pBase: number;
    seed: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

/** Independent reference using explicit exponentials and a linear survivor scan. */
function reference(logits: number[], pBase: number) {
    const exps = logits.map((v) => Math.exp(v));
    const total = exps.reduce((a, b) => a + b, 0);
    const probability = exps.map((v) => v / total);
    const cutoff = pBase * Math.max(...probability);
    const keptIndices: number[] = [];
    for (let i = 0; i < probability.length; i += 1) {
        if (probability[i]! >= cutoff - 1e-12) keptIndices.push(i);
    }
    const mass = keptIndices.reduce((s, i) => s + probability[i]!, 0);
    const truncated = probability.map((v, i) => (keptIndices.includes(i) ? v / mass : 0));
    return { probability, truncated, keptIndices, cutoff };
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

describe("Min-p sampling", () => {
    it("matches an independent reference on several inputs", () => {
        const cases: Array<[number[], number]> = [
            [[2, 1, 0.5, 0.1, -1, -2], 0.2],
            [[5, 4.9, 0, -3], 0.5],
            [[1, 1, 1, 1], 0.9],
            [[0, -1, -2], 0.01],
        ];
        for (const [logits, pBase] of cases) {
            const expected = reference(logits, pBase);
            const got = minPDistribution(logits, pBase);
            expect(new Set(got.kept)).toEqual(new Set(expected.keptIndices));
            got.truncated.forEach((v, i) => expect(close(v, expected.truncated[i]!)).toBe(true));
            expect(close(got.cutoff, expected.cutoff)).toBe(true);
        }
    });

    it("keeps probabilities nonnegative, summing to one, and never drops the top token", () => {
        const logits = [3, 2, 1, 0, -1, -2];
        const { probability, truncated, kept, cutoff } = minPDistribution(logits, 0.4);
        expect(close(probability.reduce((a, b) => a + b, 0), 1)).toBe(true);
        expect(close(truncated.reduce((a, b) => a + b, 0), 1)).toBe(true);
        expect(truncated.every((v) => v >= 0)).toBe(true);
        expect(kept.has(probability.indexOf(Math.max(...probability)))).toBe(true);
        for (const i of kept) expect(probability[i]! >= cutoff - 1e-12).toBe(true);
        for (let i = 0; i < probability.length; i += 1) {
            if (!kept.has(i)) expect(truncated[i]).toBe(0);
        }
    });

    it("sampling is seeded and always lands in the kept set", () => {
        const { truncated, kept } = minPDistribution([2, 1, 0.5, 0.1], 0.3);
        for (let seed = 0; seed < 50; seed += 1) {
            expect(sample(truncated, seed)).toBe(sample(truncated, seed));
            expect(kept.has(sample(truncated, seed))).toBe(true);
        }
        expect(uniform(3)).toBe(uniform(3));
        expect(softmax([0, 0]).every((v) => close(v, 0.5))).toBe(true);
    });

    it("matches the reference through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input.logits, input.pBase);
        const final = frames[frames.length - 1]?.meta;
        expect(new Set(final?.["kept"] as number[])).toEqual(new Set(expected.keptIndices));
        const truncated = final?.["truncated"] as number[];
        truncated.forEach((v, i) => expect(close(v, expected.truncated[i]!)).toBe(true));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
