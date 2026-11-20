/** q-learning.test.ts - Correctness and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./q-learning";
import type { VisualFrame } from "@/types";

type Transition = [number, number, number, number];
interface Input {
    transitions: Transition[];
    numStates: number;
    numActions: number;
    alpha: number;
    gamma: number;
}

/** Independent tabular Q-learning reference. */
function reference(input: Input) {
    const q = Array.from({ length: input.numStates }, () => new Array<number>(input.numActions).fill(0));
    for (const [state, action, reward, nextState] of input.transitions) {
        const future =
            nextState >= 0 && nextState < input.numStates ? Math.max(...q[nextState]!) : 0;
        const target = reward + input.gamma * future;
        q[state]![action] = q[state]![action]! + input.alpha * (target - q[state]![action]!);
    }
    return q.flat();
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
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Q-learning", () => {
    it("matches an independent Q update on several transition sequences", () => {
        const cases: Input[] = [
            {
                transitions: [[0, 1, 0, 1], [1, 1, 0, 2], [2, 1, 1, 3]],
                numStates: 4, numActions: 2, alpha: 0.5, gamma: 0.9,
            },
            {
                transitions: [[0, 0, 2, 1], [1, 1, -1, 0], [0, 0, 1, 1], [1, 1, 3, 2]],
                numStates: 3, numActions: 2, alpha: 0.3, gamma: 0.8,
            },
            mod.defaultInput as Input,
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.numStates, input.numActions);
            const expected = reference(input);
            const finalQ = frames[frames.length - 1]?.meta["q"] as number[];
            expect(finalQ.length).toBe(expected.length);
            expected.forEach((value, index) => expect(finalQ[index]).toBeCloseTo(value, 4));
        }
    });

    it("grows the value of a rewarding transition over replays", () => {
        const input: Input = {
            transitions: [[0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 1, 1]],
            numStates: 2, numActions: 2, alpha: 0.5, gamma: 0.9,
        };
        const frames = [...mod.run(input)];
        const values = frames.slice(1).map((frame) => (frame.meta["q"] as number[])[1]!);
        expect(values[0]!).toBeLessThan(values[1]!);
        expect(values[1]!).toBeLessThan(values[2]!);
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
