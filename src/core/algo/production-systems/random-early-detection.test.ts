/** random-early-detection.test.ts - Independent RED replay, probability monotonicity, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./random-early-detection";
import type { VisualFrame } from "@/types";

interface RedInput {
    queueLengths: number[];
    minTh: number;
    maxTh: number;
    maxP: number;
    weight: number;
    seed: number;
}

function reference(input: RedInput) {
    let rng = input.seed >>> 0 || 1;
    let average = 0;
    const averages: number[] = [];
    const probabilities: number[] = [];
    const decisions: number[] = [];
    for (const queue of input.queueLengths) {
        average = (1 - input.weight) * average + input.weight * queue;
        let probability: number;
        if (average < input.minTh) probability = 0;
        else if (average >= input.maxTh) probability = 1;
        else probability = (input.maxP * (average - input.minTh)) / (input.maxTh - input.minTh);
        rng = (Math.imul(1103515245, rng) + 12345) >>> 1;
        const draw = rng / 2147483648;
        averages.push(average);
        probabilities.push(probability);
        decisions.push(draw < probability ? 1 : 0);
    }
    return { averages, probabilities, decisions };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Random Early Detection", () => {
    it("matches an independent RED replay on the default input", () => {
        const input = mod.defaultInput as RedInput;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input);
        const avgs = final?.["averages"] as number[];
        const probs = final?.["probabilities"] as number[];
        avgs.forEach((value, i) => expect(value).toBeCloseTo(expected.averages[i], 10));
        probs.forEach((value, i) => expect(value).toBeCloseTo(expected.probabilities[i], 10));
        expect(final?.["decisions"]).toEqual(expected.decisions);
    });

    it("keeps drop probability in range and monotone in the average", () => {
        const input = mod.defaultInput as RedInput;
        const frames = [...mod.run(input)];
        const probs = frames[frames.length - 1]?.meta["probabilities"] as number[];
        const avgs = frames[frames.length - 1]?.meta["averages"] as number[];
        probs.forEach((p) => {
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
        });
        for (let i = 1; i < avgs.length; i += 1) {
            if ((avgs[i] ?? 0) >= (avgs[i - 1] ?? 0)) {
                expect(probs[i] ?? 0).toBeGreaterThanOrEqual(probs[i - 1] ?? 0);
            }
        }
        expect(probs.some((p) => p === 0)).toBe(true);
        expect(probs.some((p) => p === 1)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
