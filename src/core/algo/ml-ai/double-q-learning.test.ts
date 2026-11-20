/** double-q-learning.test.ts - Independent decorrelated replay, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./double-q-learning";
import type { VisualFrame } from "@/types";

type Transition = [number, number, number, number];
interface Input { numStates: number; numActions: number; transitions: Transition[]; alpha: number; gamma: number }

function reference(input: Input) {
    const q1 = Array.from({ length: input.numStates * input.numActions }, () => 0);
    const q2 = Array.from({ length: input.numStates * input.numActions }, () => 0);
    const argmax = (table: number[], state: number) => {
        let best = 0;
        for (let a = 1; a < input.numActions; a += 1) {
            if ((table[state * input.numActions + a] ?? 0) > (table[state * input.numActions + best] ?? 0)) best = a;
        }
        return best;
    };
    input.transitions.forEach(([s, a, r, sp], index) => {
        if (index % 2 === 0) {
            const best = argmax(q1, sp);
            const cell = s * input.numActions + a;
            q1[cell] = (q1[cell] ?? 0) + input.alpha * (r + input.gamma * (q2[sp * input.numActions + best] ?? 0) - (q1[cell] ?? 0));
        } else {
            const best = argmax(q2, sp);
            const cell = s * input.numActions + a;
            q2[cell] = (q2[cell] ?? 0) + input.alpha * (r + input.gamma * (q1[sp * input.numActions + best] ?? 0) - (q2[cell] ?? 0));
        }
    });
    return { q1, q2 };
}
function singleQReference(input: Input) {
    const q = Array.from({ length: input.numStates * input.numActions }, () => 0);
    for (const [s, a, r, sp] of input.transitions) {
        let best = 0;
        for (let k = 1; k < input.numActions; k += 1) if ((q[sp * input.numActions + k] ?? 0) > (q[sp * input.numActions + best] ?? 0)) best = k;
        const cell = s * input.numActions + a;
        q[cell] = (q[cell] ?? 0) + input.alpha * (r + input.gamma * (q[sp * input.numActions + best] ?? 0) - (q[cell] ?? 0));
    }
    return q;
}
function checkFrames(frames: VisualFrame[], states: number, actions: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(states * actions * 2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.meta["rows"]).toBe(states);
        expect(frame.meta["cols"]).toBe(actions * 2);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Double Q-Learning", () => {
    it("matches an independent decorrelated replay", () => {
        const cases: Input[] = [
            { numStates: 4, numActions: 2, transitions: [[0, 0, 0, 1], [1, 1, 0, 2], [2, 0, 1, 3]], alpha: 0.5, gamma: 0.9 },
            { numStates: 3, numActions: 3, transitions: [[0, 2, 1, 1], [1, 0, -1, 2], [2, 1, 2, 0], [0, 1, 0, 1], [1, 2, 3, 2]], alpha: 0.3, gamma: 0.8 },
            mod.defaultInput as Input,
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.numStates, input.numActions);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            (final?.["q1"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.q1[i]!, 5));
            (final?.["q2"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.q2[i]!, 5));
        }
    });

    it("produces values distinct from a single Q table under bias", () => {
        const input: Input = { numStates: 3, numActions: 3, transitions: [[0, 2, 1, 1], [1, 0, -1, 2], [2, 1, 2, 0], [0, 1, 0, 1], [1, 2, 3, 2]], alpha: 0.3, gamma: 0.8 };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const q1 = final?.["q1"] as number[];
        const q2 = final?.["q2"] as number[];
        const single = singleQReference(input);
        const differs = q1.some((v, i) => Math.abs(v - (single[i] ?? 0)) > 1e-3) || q2.some((v, i) => Math.abs(v - (single[i] ?? 0)) > 1e-3);
        expect(differs).toBe(true);
    });

    it("alternates which table is updated", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        expect(frames[1]?.meta["updated"]).toBe(1);
        expect(frames[2]?.meta["updated"]).toBe(2);
        expect(frames[3]?.meta["updated"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
