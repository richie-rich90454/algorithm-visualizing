/**
 * policy-gradient-reinforce.test.ts - Independent policy replay, probability
 * properties, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./policy-gradient-reinforce";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], actions: number, episodes: number): void {
    expect(frames.length).toBe(episodes + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(actions);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function probs(theta: number[]): number[] {
    const max = Math.max(...theta);
    const exp = theta.map((t) => Math.exp(t - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((e) => e / sum);
}

function pick(p: number[], draw: number): number {
    let acc = 0;
    for (let i = 0; i < p.length; i += 1) {
        acc += p[i];
        if (draw < acc) return i;
    }
    return p.length - 1;
}

/** Reference trajectory of logits after each episode. */
function replay(
    theta0: number[],
    rewards: number[],
    draws: number[],
    lr: number,
    baseline: boolean,
): number[][] {
    const theta = [...theta0];
    const trace: number[][] = [];
    for (const draw of draws) {
        const p = probs(theta);
        const a = pick(p, draw);
        const b = baseline ? rewards.reduce((x, y) => x + y, 0) / rewards.length : 0;
        const G = rewards[a] - b;
        for (let i = 0; i < theta.length; i += 1) {
            theta[i] += lr * G * ((i === a ? 1 : 0) - p[i]);
        }
        trace.push([...theta]);
    }
    return trace;
}

describe("PolicyGradientReinforce", () => {
    it("matches an independent policy replay on the default input", () => {
        const input = mod.defaultInput as {
            theta: number[];
            rewards: number[];
            draws: number[];
            learningRate: number;
            baseline: boolean;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.theta.length, input.draws.length);
        const trace = replay(input.theta, input.rewards, input.draws, input.learningRate, input.baseline);
        trace.forEach((expected, e) => {
            const actual = frames[e + 1]?.meta["theta"] as number[];
            expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 9));
        });
        const finalTrace = trace[trace.length - 1];
        const finalActual = frames[frames.length - 1]?.meta["theta"] as number[];
        finalTrace.forEach((value, i) => expect(finalActual[i]).toBeCloseTo(value, 9));
    });

    it("keeps probabilities normalized and reinforces positive returns", () => {
        const theta = [0, 0, 0];
        const rewards = [2, 0, -1];
        const frames = [...mod.run({ theta, rewards, draws: [0.1], learningRate: 0.5, baseline: false })];
        checkFrames(frames, 3, 1);
        frames.forEach((frame) => {
            const p = frame.meta["probs"] as number[];
            expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
            p.forEach((value) => expect(value).toBeGreaterThanOrEqual(0));
        });
        const before = frames[0]?.meta["probs"] as number[];
        const after = frames[1]?.meta["probs"] as number[];
        const chosen = Number(frames[1]?.meta["chosen"]);
        expect(after[chosen]).toBeGreaterThan(before[chosen]);
    });

    it("matches replay with the baseline disabled", () => {
        const input = { theta: [0.5, -0.5], rewards: [3, 1], draws: [0.3, 0.8, 0.4], learningRate: 0.2, baseline: false };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2, 3);
        const trace = replay(input.theta, input.rewards, input.draws, input.learningRate, false);
        trace.forEach((expected, e) => {
            const actual = frames[e + 1]?.meta["theta"] as number[];
            expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 9));
        });
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
