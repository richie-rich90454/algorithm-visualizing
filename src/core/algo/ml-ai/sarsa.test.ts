/** sarsa.test.ts - Independent tabular replay, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./sarsa";
import type { VisualFrame } from "@/types";

type Transition = [number, number, number, number, number];
interface Input { numStates: number; numActions: number; transitions: Transition[]; alpha: number; gamma: number }

function reference(input: Input) {
    const q = Array.from({ length: input.numStates * input.numActions }, () => 0);
    for (const [s, a, r, sp, ap] of input.transitions) {
        const index = s * input.numActions + a;
        const next = sp * input.numActions + ap;
        q[index] = (q[index] ?? 0) + input.alpha * (r + input.gamma * (q[next] ?? 0) - (q[index] ?? 0));
    }
    return q;
}

/** Q-learning reference to prove SARSA is distinct (uses a max, not the taken action). */
function qLearningReference(input: Input) {
    const q = Array.from({ length: input.numStates * input.numActions }, () => 0);
    for (const [s, a, r, sp] of input.transitions) {
        let best = 0;
        for (let k = 0; k < input.numActions; k += 1) best = Math.max(best, q[sp * input.numActions + k] ?? 0);
        const index = s * input.numActions + a;
        q[index] = (q[index] ?? 0) + input.alpha * (r + input.gamma * best - (q[index] ?? 0));
    }
    return q;
}

function checkFrames(frames: VisualFrame[], states: number, actions: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(states * actions);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.meta["rows"]).toBe(states);
        expect(frame.meta["cols"]).toBe(actions);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SARSA", () => {
    it("matches an independent on-policy tabular replay", () => {
        const cases: Input[] = [
            { numStates: 4, numActions: 2, transitions: [[0, 0, 0, 1, 1], [1, 1, 0, 2, 0], [2, 0, 1, 3, 1]], alpha: 0.5, gamma: 0.9 },
            { numStates: 3, numActions: 3, transitions: [[0, 2, 1, 1, 0], [1, 0, -1, 2, 2], [2, 1, 2, 0, 1], [0, 1, 0, 1, 1]], alpha: 0.3, gamma: 0.8 },
            mod.defaultInput as Input,
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.numStates, input.numActions);
            const expected = reference(input);
            const finalQ = frames[frames.length - 1]?.meta["q"] as number[];
            expected.forEach((v, i) => expect(finalQ[i]).toBeCloseTo(v, 5));
        }
    });

    it("differs from off-policy Q-learning when next actions are not greedy", () => {
        const input: Input = { numStates: 3, numActions: 3, transitions: [[0, 2, 1, 1, 0], [1, 0, -1, 2, 2], [2, 1, 2, 0, 1], [0, 1, 0, 1, 1]], alpha: 0.3, gamma: 0.8 };
        const frames = [...mod.run(input)];
        const sarsaQ = frames[frames.length - 1]?.meta["q"] as number[];
        const qLearn = qLearningReference(input);
        expect(sarsaQ.some((v, i) => Math.abs(v - (qLearn[i] ?? 0)) > 1e-3)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
