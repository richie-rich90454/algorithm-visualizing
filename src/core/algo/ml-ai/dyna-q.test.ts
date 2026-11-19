/** dyna-q.test.ts - Independent direct plus planning replay, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./dyna-q";
import type { VisualFrame } from "@/types";

type Transition = [number, number, number, number];
interface Input { numStates: number; numActions: number; transitions: Transition[]; alpha: number; gamma: number; planningSteps: number }

/** Independent replay of Dyna-Q direct updates and model replays. */
function reference(input: Input) {
    const q = Array.from({ length: input.numStates * input.numActions }, () => 0);
    const maxNext = (state: number) => {
        let best = 0;
        for (let a = 0; a < input.numActions; a += 1) best = Math.max(best, q[state * input.numActions + a] ?? 0);
        return best;
    };
    const apply = ([s, a, r, sp]: Transition) => {
        const index = s * input.numActions + a;
        q[index] = (q[index] ?? 0) + input.alpha * (r + input.gamma * maxNext(sp) - (q[index] ?? 0));
    };
    const model: Transition[] = [];
    for (const t of input.transitions) {
        model.push([...t]);
        apply(t);
    }
    for (let i = 0; i < input.planningSteps && model.length > 0; i += 1) apply(model[i % model.length]!);
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

describe("Dyna-Q", () => {
    it("matches an independent direct plus planning replay", () => {
        const cases: Input[] = [
            { numStates: 4, numActions: 2, transitions: [[0, 0, 0, 1], [1, 1, 0, 2], [2, 0, 1, 3]], alpha: 0.5, gamma: 0.9, planningSteps: 6 },
            { numStates: 3, numActions: 3, transitions: [[0, 2, 1, 1], [1, 0, -1, 2], [2, 1, 2, 0], [0, 2, 0, 2]], alpha: 0.3, gamma: 0.5, planningSteps: 10 },
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

    it("planning replays change Q after the direct phase ends", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const directFrames = frames.filter((f) => f.meta["phase"] === "direct");
        const planningFrames = frames.filter((f) => f.meta["phase"] === "planning");
        expect(directFrames.length).toBe(input.transitions.length);
        expect(planningFrames.length).toBe(input.planningSteps);
        const afterDirect = directFrames[directFrames.length - 1]?.meta["q"] as number[];
        const afterPlanning = frames[frames.length - 1]?.meta["q"] as number[];
        expect(afterPlanning.some((v, i) => Math.abs(v - (afterDirect[i] ?? 0)) > 1e-6)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
