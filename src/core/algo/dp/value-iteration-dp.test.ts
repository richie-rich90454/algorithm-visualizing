/**
 * value-iteration-dp.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./value-iteration-dp";
import type { VisualFrame } from "@/types";

type Outcome = [number, number, number];
type Transitions = Outcome[][][];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

interface Input {
    states: number;
    gamma: number;
    transitions: Transitions;
    iterations: number;
    epsilon: number;
}

function resultOf(input: Input) {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    const meta = frames[frames.length - 1]?.meta ?? {};
    return { values: meta["values"] as number[], actions: meta["actions"] as number[] };
}

function bellmanResidual(input: Input, values: number[]): number {
    let worst = 0;
    for (let s = 0; s < input.states; s += 1) {
        const actions = input.transitions[s] ?? [];
        let best = actions.length === 0 ? 0 : Number.NEGATIVE_INFINITY;
        for (const outcomes of actions) {
            let q = 0;
            for (const outcome of outcomes) {
                q += outcome[1] * (outcome[2] + input.gamma * (values[outcome[0]] ?? 0));
            }
            best = Math.max(best, q);
        }
        worst = Math.max(worst, Math.abs((values[s] ?? 0) - best));
    }
    return worst;
}

describe("Value Iteration", () => {
    it("converges to the closed-form solution on the default MDP", () => {
        const input = mod.defaultInput as Input;
        const got = resultOf(input);
        expect(got.values.length).toBe(3);
        expect(got.values[0]).toBeCloseTo(5, 5);
        expect(got.values[1]).toBeCloseTo(4, 5);
        expect(got.values[2]).toBeCloseTo(0, 5);
        expect(bellmanResidual(input, got.values)).toBeLessThan(1e-5);
    });

    it("matches the geometric series for a self-looping reward", () => {
        const input: Input = {
            states: 1,
            gamma: 0.5,
            transitions: [[[[0, 1, 1]]]],
            iterations: 80,
            epsilon: 1e-10,
        };
        const got = resultOf(input);
        expect(got.values[0]).toBeCloseTo(2, 6);
        expect(bellmanResidual(input, got.values)).toBeLessThan(1e-6);
    });

    it("satisfies the Bellman fixed point across randomized small MDPs", () => {
        let seed = 314;
        const rand = () => {
            seed = (1103515245 * seed + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 12; trial += 1) {
            const states = 2 + Math.floor(rand() * 3);
            const transitions: Transitions = [];
            for (let s = 0; s < states; s += 1) {
                const actionCount = 1 + Math.floor(rand() * 3);
                const actions: Outcome[][] = [];
                for (let a = 0; a < actionCount; a += 1) {
                    actions.push([[Math.floor(rand() * states), 1, Math.floor(rand() * 7) - 3]]);
                }
                transitions.push(actions);
            }
            const input: Input = { states, gamma: 0.4, transitions, iterations: 120, epsilon: 1e-9 };
            const got = resultOf(input);
            expect(bellmanResidual(input, got.values)).toBeLessThan(1e-5);
        }
    });

    it("handles an empty state set", () => {
        const input: Input = { states: 0, gamma: 0.9, transitions: [], iterations: 5, epsilon: 1e-6 };
        const frames = [...mod.run(input)];
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[frames.length - 1]?.meta["values"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
