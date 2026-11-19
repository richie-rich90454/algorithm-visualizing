/**
 * policy-iteration.test.ts - Independent value-iteration cross-check, greedy
 * policy verification, frame-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./policy-iteration";
import type { VisualFrame } from "@/types";

interface MDP {
    transitions: number[][][];
    rewards: number[][][];
    discount: number;
}

/** Independent value iteration reference. */
function valueIteration(mdp: MDP): number[] {
    const nS = mdp.transitions.length;
    const nA = mdp.transitions[0]?.length ?? 0;
    const V = Array<number>(nS).fill(0);
    for (let iteration = 0; iteration < 20000; iteration += 1) {
        let delta = 0;
        const next = Array<number>(nS).fill(0);
        for (let s = 0; s < nS; s += 1) {
            let best = -Infinity;
            for (let a = 0; a < nA; a += 1) {
                let q = 0;
                const probs = mdp.transitions[s]?.[a] ?? [];
                const rew = mdp.rewards[s]?.[a] ?? [];
                for (let sp = 0; sp < nS; sp += 1) {
                    q += (probs[sp] ?? 0) * ((rew[sp] ?? 0) + mdp.discount * (V[sp] ?? 0));
                }
                best = Math.max(best, q);
            }
            next[s] = best;
            delta = Math.max(delta, Math.abs(best - (V[s] ?? 0)));
        }
        for (let s = 0; s < nS; s += 1) V[s] = next[s] ?? 0;
        if (delta < 1e-11) break;
    }
    return V;
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta.rows).toBe(rows);
        expect(frame.meta.cols).toBe(cols);
    });
}

describe("PolicyIteration", () => {
    it("matches an independent value iteration solution on the default MDP", () => {
        const mdp = mod.defaultInput as MDP;
        const frames = [...mod.run(mdp)];
        const nS = mdp.transitions.length;
        const nA = mdp.transitions[0]?.length ?? 0;
        checkFrames(frames, nS, nA);
        const final = frames[frames.length - 1];
        const V = final?.meta.V as number[];
        const expected = valueIteration(mdp);
        for (let s = 0; s < nS; s += 1) {
            expect(Math.abs((V[s] as number) - (expected[s] as number))).toBeLessThan(1e-5);
        }
        expect(final?.meta.stable).toBe(true);
    });

    it("ends with a policy greedy for the final state values", () => {
        const mdp = mod.defaultInput as MDP;
        const frames = [...mod.run(mdp)];
        const final = frames[frames.length - 1];
        const policy = final?.meta.policy as number[];
        const q = final?.meta.q as number[];
        const nA = mdp.transitions[0]?.length ?? 0;
        for (let s = 0; s < mdp.transitions.length; s += 1) {
            let best = -Infinity;
            let bestAction = 0;
            for (let a = 0; a < nA; a += 1) {
                const value = q[s * nA + a] as number;
                if (value > best) {
                    best = value;
                    bestAction = a;
                }
            }
            expect(policy[s]).toBe(bestAction);
        }
    });

    it("solves a custom MDP and never decreases values across iterations", () => {
        const mdp: MDP = {
            transitions: [
                [[0.5, 0.5, 0], [0, 0.2, 0.8]],
                [[0, 1, 0], [0.9, 0.1, 0]],
                [[0, 0, 1], [0.3, 0.3, 0.4]],
            ],
            rewards: [
                [[1, 1, 1], [2, 2, 2]],
                [[0, 0, 0], [4, 4, 4]],
                [[3, 3, 3], [5, 5, 5]],
            ],
            discount: 0.8,
        };
        const frames = [...mod.run(mdp)];
        const final = frames[frames.length - 1];
        const V = final?.meta.V as number[];
        const expected = valueIteration(mdp);
        for (let s = 0; s < mdp.transitions.length; s += 1) {
            expect(Math.abs((V[s] as number) - (expected[s] as number))).toBeLessThan(1e-5);
        }
        const valueFrames = frames.filter((frame) => Array.isArray(frame.meta.V));
        for (let i = 1; i < valueFrames.length; i += 1) {
            const previous = valueFrames[i - 1]?.meta.V as number[];
            const current = valueFrames[i]?.meta.V as number[];
            for (let s = 0; s < current.length; s += 1) {
                expect((current[s] as number) + 1e-6).toBeGreaterThanOrEqual(previous[s] as number);
            }
        }
    });

    it("handles an empty MDP and terminates cleanly", () => {
        const empty = [...mod.run({ transitions: [], rewards: [], discount: 0.9 })];
        expect(empty.length).toBe(1);
        expect(empty[0]?.meta.iterations).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
