/**
 * actor-critic.test.ts - Update equation cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./actor-critic";
import type { VisualFrame } from "@/types";

interface Input {
    rewards: number[];
    gamma?: number;
    actorStep?: number;
    criticStep?: number;
    steps?: number;
}

function checkFrames(frames: VisualFrame[], actions: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(actions + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Number(frame.meta["probSum"])).toBeCloseTo(1, 6);
    });
}

describe("ActorCritic", () => {
    it("matches an independent TD update sequence", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.rewards.length);
        const gamma = input.gamma ?? 0.9;
        const actorStep = input.actorStep ?? 0.5;
        const criticStep = input.criticStep ?? 0.1;
        const logits = input.rewards.map(() => 0);
        let value = 0;
        const softmax = (l: number[]): number[] => {
            const max = Math.max(...l);
            const e = l.map((v) => Math.exp(v - max));
            const t = e.reduce((a, b) => a + b, 0);
            return e.map((v) => v / t);
        };
        let probs = softmax(logits);
        for (let t = 0; t < (input.steps ?? 30); t += 1) {
            let action = 0;
            for (let i = 1; i < probs.length; i += 1) {
                if ((probs[i] ?? 0) > (probs[action] ?? 0)) {
                    action = i;
                }
            }
            const reward = input.rewards[action] ?? 0;
            const delta = reward + gamma * value - value;
            value += criticStep * delta;
            logits[action] = (logits[action] ?? 0) + actorStep * delta;
            probs = softmax(logits);
            const frame = frames[t + 1];
            expect(Number(frame?.meta["delta"])).toBeCloseTo(delta, 6);
            expect(Number(frame?.meta["value"])).toBeCloseTo(value, 6);
            expect(frame?.meta["action"]).toBe(action);
        }
    });

    it("favors the rewarded action", () => {
        const input: Input = { rewards: [1, -1], gamma: 0.9, actorStep: 0.5, criticStep: 0.1, steps: 50 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1];
        const probs = final?.meta["probs"] as number[];
        expect(probs[0]).toBeGreaterThan(0.9);
        expect(probs[1]).toBeLessThan(0.1);
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
