/**
 * temporal-difference-learning.test.ts - Reference replay, Bellman property, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./temporal-difference-learning";
import type { VisualFrame } from "@/types";

function reference(states: number, alpha: number, gamma: number, sweeps: number): number[] {
    const values = Array.from({ length: states }, () => 0);
    for (let sweep = 0; sweep < sweeps; sweep += 1) {
        for (let s = 0; s < states - 1; s += 1) {
            const reward = s + 1 === states - 1 ? 1 : 0;
            values[s] = values[s]! + alpha * (reward + gamma * values[s + 1]! - values[s]!);
        }
    }
    return values;
}

function checkFrames(frames: VisualFrame[], states: number, sweeps: number): void {
    expect(frames.length).toBe(1 + sweeps * (states - 1) + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(states);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const values = frame.meta["values"] as number[];
        expect(values).toHaveLength(states);
        expect(values.every((v) => v >= -1e-9)).toBe(true);
    });
}

describe("TemporalDifferenceLearning", () => {
    it("matches an independent TD(0) replay exactly", () => {
        const input = mod.defaultInput as {
            states: number;
            alpha: number;
            gamma: number;
            sweeps: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.states, input.sweeps);
        const expected = reference(input.states, input.alpha, input.gamma, input.sweeps);
        const finalMeta = frames[frames.length - 1]?.meta;
        const values = finalMeta?.["values"] as number[];
        for (let i = 0; i < values.length; i += 1) {
            expect(values[i]!).toBeCloseTo(expected[i]!, 5);
        }
    });

    it("converges to the discounted distance to the goal", () => {
        for (const gamma of [0.5, 0.8, 0.95]) {
            const states = 6;
            const frames = [...mod.run({ states, alpha: 0.4, gamma, sweeps: 80 })];
            checkFrames(frames, states, 80);
            const values = frames[frames.length - 1]?.meta["values"] as number[];
            for (let s = 0; s < states - 1; s += 1) {
                expect(values[s]!).toBeCloseTo(gamma ** (states - 2 - s), 2);
            }
            expect(values[states - 1]).toBe(0);
            expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
        }
    });

    it("records the TD error and reward on every update frame", () => {
        const frames = [...mod.run({ states: 4, alpha: 0.3, gamma: 0.9, sweeps: 2 })];
        checkFrames(frames, 4, 2);
        const updateFrame = frames[1]!;
        expect(updateFrame.meta["reward"]).toBe(0);
        expect(typeof updateFrame.meta["tdError"]).toBe("number");
        expect(typeof updateFrame.meta["nextValue"]).toBe("number");
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
