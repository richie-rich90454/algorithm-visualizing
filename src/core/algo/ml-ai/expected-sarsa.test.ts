/** expected-sarsa.test.ts - Independent expected-backup replay, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./expected-sarsa";
import type { VisualFrame } from "@/types";

type Transition = [number, number, number, number];
interface Input { numStates: number; numActions: number; transitions: Transition[]; alpha: number; gamma: number; epsilon: number }

function expectedValue(q: number[], state: number, numActions: number, epsilon: number): number {
    let greedy = 0;
    for (let a = 1; a < numActions; a += 1) {
        if ((q[state * numActions + a] ?? 0) > (q[state * numActions + greedy] ?? 0)) greedy = a;
    }
    const uniform = epsilon / numActions;
    let total = 0;
    for (let a = 0; a < numActions; a += 1) {
        const probability = a === greedy ? 1 - epsilon + uniform : uniform;
        total += probability * (q[state * numActions + a] ?? 0);
    }
    return total;
}
function reference(input: Input) {
    const q = Array.from({ length: input.numStates * input.numActions }, () => 0);
    for (const [s, a, r, sp] of input.transitions) {
        const expected = expectedValue(q, sp, input.numActions, input.epsilon);
        const index = s * input.numActions + a;
        q[index] = (q[index] ?? 0) + input.alpha * (r + input.gamma * expected - (q[index] ?? 0));
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

describe("Expected SARSA", () => {
    it("matches an independent expected-backup replay", () => {
        const cases: Input[] = [
            { numStates: 4, numActions: 2, transitions: [[0, 0, 0, 1], [1, 1, 0, 2], [2, 0, 1, 3]], alpha: 0.5, gamma: 0.9, epsilon: 0.1 },
            { numStates: 3, numActions: 3, transitions: [[0, 2, 1, 1], [1, 0, -1, 2], [2, 1, 2, 0], [0, 1, 0, 1]], alpha: 0.3, gamma: 0.8, epsilon: 0.2 },
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

    it("epsilon zero matches the greedy max backup of Q-learning", () => {
        const input: Input = { numStates: 3, numActions: 3, transitions: [[0, 2, 1, 1], [1, 0, -1, 2], [2, 1, 2, 0], [0, 1, 0, 1]], alpha: 0.3, gamma: 0.8, epsilon: 0 };
        const frames = [...mod.run(input)];
        const q = frames[frames.length - 1]?.meta["q"] as number[];
        const qLearn = Array.from({ length: input.numStates * input.numActions }, () => 0);
        for (const [s, a, r, sp] of input.transitions) {
            let best = 0;
            for (let k = 0; k < input.numActions; k += 1) best = Math.max(best, qLearn[sp * input.numActions + k] ?? 0);
            const index = s * input.numActions + a;
            qLearn[index] = (qLearn[index] ?? 0) + input.alpha * (r + input.gamma * best - (qLearn[index] ?? 0));
        }
        q.forEach((v, i) => expect(v).toBeCloseTo(qLearn[i]!, 5));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
