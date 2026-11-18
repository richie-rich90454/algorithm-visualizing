/**
 * dreamerv3.test.ts - Independent rollout replay, discount edge cases, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { WORLD_B, WORLD_C, WORLD_M, dreamerRollout, worldStep } from "./dreamerv3";
import type { VisualFrame } from "@/types";

type Input = { h0: number[]; actions: number[]; gamma: number };

/** Independent replay of the toy dynamics and discounted backup. */
function reference(h0: number[], actions: number[], gamma: number) {
    let h = h0.slice();
    const rewards: number[] = [];
    const states: number[][] = [h.slice()];
    let value = 0;
    for (let t = 0; t < actions.length; t += 1) {
        const a = actions[t] ?? 0;
        const M = WORLD_M[a] ?? [];
        const reward = Math.max(-1, Math.min(1, (WORLD_C[a]?.[0] ?? 0) * (h[0] ?? 0) + (WORLD_C[a]?.[1] ?? 0) * (h[1] ?? 0)));
        h = M.map((row, i) => Math.tanh((row[0] ?? 0) * (h[0] ?? 0) + (row[1] ?? 0) * (h[1] ?? 0) + (WORLD_B[a]?.[i] ?? 0)));
        rewards.push(reward);
        states.push(h.slice());
        value += gamma ** t * reward;
    }
    return { rewards, states, value, final: h };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("DreamerV3 rollout teaching core", () => {
    it("matches an independent replay of the imagined trajectory", () => {
        const cases: Input[] = [
            { h0: [0, 0], actions: [0, 1, 2, 0], gamma: 0.9 },
            { h0: [0.5, -0.3], actions: [2, 2, 1], gamma: 0.5 },
            { h0: [-1, 1], actions: [1, 0, 2, 1, 0], gamma: 1 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input.h0, input.actions, input.gamma);
            const final = frames[frames.length - 1]?.meta ?? {};
            expect(final["value"] as number).toBeCloseTo(expected.value, 9);
            expect(final["rewards"] as number[]).toEqual(expected.rewards);
            expect((final["contributions"] as number[]).length).toBe(input.actions.length);
            const states = final["states"] as number[];
            expect(states).toHaveLength(expected.states.length * 2);
            expected.states.forEach((state, s) =>
                state.forEach((v, j) => expect(states[s * 2 + j] ?? 0).toBeCloseTo(v, 9)),
            );
        }
    });

    it("obeys discount and horizon edge cases", () => {
        const input: Input = { h0: [0.4, 0.2], actions: [0, 1, 2], gamma: 0 };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta ?? {};
        const first = worldStep(input.h0, 0).reward;
        expect(final["value"] as number).toBeCloseTo(first, 9);
        const oneStep = [...mod.run({ h0: input.h0, actions: [0], gamma: 1 })];
        expect(oneStep[oneStep.length - 1]?.meta["value"]).toBeCloseTo(first, 9);
        const pure = dreamerRollout(input.h0, input.actions, 1);
        expect(pure.value).toBeCloseTo(pure.steps.reduce((s, x) => s + x.reward, 0), 9);
    });

    it("keeps imagined latents inside the tanh range after a transition", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const states = frames[frames.length - 1]?.meta["states"] as number[];
        for (let i = 2; i < states.length; i += 1) {
            expect(Math.abs(states[i] ?? 0)).toBeLessThanOrEqual(1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
