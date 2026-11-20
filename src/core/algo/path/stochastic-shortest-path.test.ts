/**
 * stochastic-shortest-path.test.ts - Fixed-point check, exact DAG cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./stochastic-shortest-path";
import type { VisualFrame } from "@/types";

type Outcome = [number, number, number];
type Transitions = Outcome[][][];

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Exact values for an acyclic problem by backward induction (reverse order). */
function backwardInduction(transitions: Transitions, goal: number): number[] {
    const values = new Array<number>(transitions.length).fill(0);
    for (let s = transitions.length - 1; s >= 0; s -= 1) {
        if (s === goal) {
            values[s] = 0;
            continue;
        }
        let best = Infinity;
        for (const action of transitions[s] ?? []) {
            let expected = 0;
            for (const [next, probability, cost] of action) {
                expected += probability * (cost + (values[next] ?? 0));
            }
            best = Math.min(best, expected);
        }
        values[s] = Number.isFinite(best) ? best : 0;
    }
    return values;
}

function seedFrom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("Stochastic Shortest Path", () => {
    it("converges to the exact backward-induction values on the default DAG", () => {
        const input = mod.defaultInput as { transitions: Transitions; goal: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.transitions.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        const values = finalMeta?.["values"] as number[];
        const expected = backwardInduction(input.transitions, input.goal);
        expect(values.length).toBe(expected.length);
        for (let i = 0; i < expected.length; i += 1) {
            expect(values[i]).toBeCloseTo(expected[i] ?? 0, 6);
        }
        expect(finalMeta?.["converged"]).toBe(true);
        const policy = finalMeta?.["policy"] as number[];
        expect(policy[0]).toBe(1);
    });

    it("respects the Bellman optimality fixed point on random acyclic problems", () => {
        const rand = seedFrom(7);
        for (let trial = 0; trial < 15; trial += 1) {
            const n = 1 + Math.floor(rand() * 4);
            const goal = n;
            const transitions: Transitions = [];
            for (let s = 0; s < n; s += 1) {
                const actions: Outcome[][] = [];
                const actionCount = 1 + Math.floor(rand() * 2);
                for (let a = 0; a < actionCount; a += 1) {
                    const outcomes: Outcome[] = [];
                    const outcomeCount = 1 + Math.floor(rand() * 2);
                    for (let o = 0; o < outcomeCount; o += 1) {
                        const next = s + 1 + Math.floor(rand() * (goal - s));
                        outcomes.push([next, outcomeCount === 1 ? 1 : 0.5, Math.floor(rand() * 6)]);
                    }
                    actions.push(outcomes);
                }
                transitions.push(actions);
            }
            transitions.push([]);

            const frames = [...mod.run({ transitions, goal, tolerance: 1e-11, maxIterations: 500 })];
            checkFrames(frames, n + 1);
            const values = frames[frames.length - 1]?.meta["values"] as number[];
            const expected = backwardInduction(transitions, goal);
            for (let i = 0; i < expected.length; i += 1) {
                expect(values[i]).toBeCloseTo(expected[i] ?? 0, 6);
            }
            for (let s = 0; s < n; s += 1) {
                let best = Infinity;
                for (const action of transitions[s] ?? []) {
                    let expectedCost = 0;
                    for (const [next, probability, cost] of action) {
                        expectedCost += probability * (cost + (values[next] ?? 0));
                    }
                    best = Math.min(best, expectedCost);
                }
                expect(values[s]).toBeCloseTo(best, 6);
            }
        }
    });

    it("terminates cleanly and handles an empty problem", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);

        const empty = [...mod.run({ transitions: [], goal: -1 })];
        expect(empty.length).toBe(1);
        expect(empty[0]?.entities.length).toBe(1);
    });
});
