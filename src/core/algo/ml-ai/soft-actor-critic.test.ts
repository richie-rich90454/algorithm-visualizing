/** soft-actor-critic.test.ts - Brute-force fixed point, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./soft-actor-critic";
import type { VisualFrame } from "@/types";

interface Input {
    rewards: number[];
    temperature: number;
    gamma: number;
    learningRate: number;
    iterations: number;
}

function softValue(q: number[], temperature: number): number {
    const scaled = q.map((v) => v / temperature);
    const max = Math.max(...scaled);
    return temperature * (max + Math.log(scaled.reduce((a, v) => a + Math.exp(v - max), 0)));
}

function refPolicy(q: number[], temperature: number): number[] {
    const scaled = q.map((v) => v / temperature);
    const max = Math.max(...scaled);
    const exp = scaled.map((v) => Math.exp(v - max));
    const total = exp.reduce((a, v) => a + v, 0);
    return exp.map((v) => v / total);
}

/** Independent replay of the soft Bellman update on a single state. */
function reference(input: Input) {
    const q = input.rewards.map(() => 0);
    for (let iteration = 0; iteration < input.iterations; iteration += 1) {
        const value = softValue(q, input.temperature);
        const next = q.map((cur, i) => cur + input.learningRate * ((input.rewards[i] ?? 0) + input.gamma * value - cur));
        for (let i = 0; i < q.length; i += 1) q[i] = next[i] ?? 0;
    }
    return q;
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
    const final = frames[frames.length - 1]?.meta;
    const q = final?.["q"] as number[];
    const temperature = Number(final?.["temperature"]);
    expect(final?.["softValue"]).toBeCloseTo(softValue(q, temperature), 4);
    const pi = refPolicy(q, temperature);
    (final?.["policy"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(pi[i]!, 4));
}

describe("Soft Actor-Critic", () => {
    it("matches a brute-force soft Bellman replay on several inputs", () => {
        const cases: Input[] = [
            { rewards: [1, 0, -1, 0.5], temperature: 1, gamma: 0.9, learningRate: 0.2, iterations: 12 },
            { rewards: [3, 1, 2], temperature: 0.5, gamma: 0.5, learningRate: 0.3, iterations: 20 },
            { rewards: [0, 0, 0], temperature: 2, gamma: 0.99, learningRate: 0.1, iterations: 8 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.rewards.length);
            const expected = reference(input);
            const finalQ = frames[frames.length - 1]?.meta["q"] as number[];
            expected.forEach((v, i) => expect(finalQ[i]).toBeCloseTo(v, 5));
        }
    });

    it("converges toward the exact fixed point for a long run", () => {
        const input: Input = { rewards: [2, 1, 0], temperature: 1, gamma: 0.9, learningRate: 0.2, iterations: 2000 };
        const frames = [...mod.run(input)];
        const finalQ = frames[frames.length - 1]?.meta["q"] as number[];
        const v = softValue(finalQ, 1);
        finalQ.forEach((value, i) => expect(value).toBeCloseTo((input.rewards[i] ?? 0) + 0.9 * v, 3));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
