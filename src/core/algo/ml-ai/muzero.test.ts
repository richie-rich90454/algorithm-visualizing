/** muzero.test.ts - Brute-force latent search, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./muzero";
import type { VisualFrame } from "@/types";

interface Input {
    hidden: number[];
    actions: number[][];
    gamma: number;
    rewardWeights: number[];
    valueWeights: number[];
    policyWeights: number[][];
    temperature: number;
}
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
function softmax(values: number[]): number[] {
    const max = Math.max(...values);
    const exp = values.map((v) => Math.exp(v - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / sum);
}
function reference(input: Input) {
    const scores = input.actions.map((vec) => {
        const next = input.hidden.map((v, i) => v + (vec[i] ?? 0));
        const reward = dot(next, input.rewardWeights);
        const value = dot(next, input.valueWeights);
        return reward + input.gamma * value;
    });
    return { scores, chosen: scores.indexOf(Math.max(...scores)), policy: softmax(input.policyWeights.map((row) => dot(input.hidden, row) / input.temperature)) };
}
function checkFrames(frames: VisualFrame[], actions: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(actions);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const policy = frame.meta["policy"] as number[];
        expect(policy.reduce((a, v) => a + v, 0)).toBeCloseTo(1, 6);
    });
}

describe("MuZero Latent Search", () => {
    it("matches a brute-force one-step latent backup", () => {
        const cases: Input[] = [
            { hidden: [1, 0.5, -0.5], actions: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], gamma: 0.9, rewardWeights: [1, 0.5, 0], valueWeights: [0.5, 1, 0.2], policyWeights: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], temperature: 1 },
            { hidden: [2, -1], actions: [[1, 1], [-1, 0], [0, -1]], gamma: 0.5, rewardWeights: [0.3, 0.7], valueWeights: [1, 1], policyWeights: [[1, 0], [0, 1], [0.5, 0.5]], temperature: 0.7 },
            mod.defaultInput as Input,
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.actions.length);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["scores"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.scores[i]!, 5));
            expect(final?.["chosen"]).toBe(expected.chosen);
            (final?.["policy"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.policy[i]!, 5));
        }
    });

    it("chooses the action with the highest backed-up score", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const scores = frames[frames.length - 1]?.meta["scores"] as number[];
        const chosen = Number(frames[frames.length - 1]?.meta["chosen"]);
        expect(scores[chosen]).toBe(Math.max(...scores));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
