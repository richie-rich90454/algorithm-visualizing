/** prioritized-experience-replay.test.ts - Brute-force replay math, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./prioritized-experience-replay";
import type { VisualFrame } from "@/types";

interface Input { priorities: number[]; alpha: number; beta: number; epsilon: number; batch: number[]; newPriorities: number[] }
function probabilities(p: number[], alpha: number): number[] {
    const raw = p.map((v) => Math.pow(Math.max(1e-12, v), alpha));
    const total = raw.reduce((a, b) => a + b, 0) || 1;
    return raw.map((v) => v / total);
}
function reference(input: Input) {
    const n = input.priorities.length;
    const p = input.priorities.map((v) => Math.max(input.epsilon, v));
    const probs = probabilities(p, input.alpha);
    const raw = input.batch.map((i) => Math.pow((1 / n) / (probs[i] ?? (1 / n)), input.beta));
    const max = Math.max(...raw, 1e-12);
    const isWeights = raw.map((w) => w / max);
    input.batch.forEach((i, k) => { p[i] = Math.max(input.epsilon, input.newPriorities[k] ?? input.epsilon); });
    return { priorities: p, probs, isWeights, finalProbs: probabilities(p, input.alpha) };
}
function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const probs = frame.meta["probs"] as number[];
        expect(probs.reduce((a, v) => a + v, 0)).toBeCloseTo(1, 5);
    });
}

describe("Prioritized Experience Replay", () => {
    it("matches brute-force probabilities, weights, and updated priorities", () => {
        const cases: Input[] = [
            { priorities: [4, 1, 3, 0.5, 2], alpha: 0.6, beta: 0.4, epsilon: 0.01, batch: [0, 2], newPriorities: [1.5, 2.5] },
            { priorities: [1, 1, 1, 1], alpha: 0, beta: 0, epsilon: 0.001, batch: [0, 1, 3], newPriorities: [2, 0.5, 4] },
            { priorities: [0, 5, 2, 7, 3, 1], alpha: 1, beta: 1, epsilon: 0.1, batch: [1, 4, 5], newPriorities: [3, 0.2, 6] },
            mod.defaultInput as Input,
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.priorities.length);
            const expected = reference(input);
            const init = frames[0]?.meta;
            (init?.["probs"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.probs[i]!, 5));
            (init?.["isWeights"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.isWeights[i]!, 5));
            const final = frames[frames.length - 1]?.meta;
            (final?.["priorities"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.priorities[i]!, 5));
            (final?.["probs"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.finalProbs[i]!, 5));
        }
    });

    it("higher priority yields higher sampling probability and lower weight", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const init = frames[0]?.meta;
        const probs = init?.["probs"] as number[];
        const high = input.priorities.indexOf(Math.max(...input.priorities));
        const low = input.priorities.indexOf(Math.min(...input.priorities));
        expect(probs[high]!).toBeGreaterThan(probs[low]!);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
