/**
 * dueling-dqn.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./dueling-dqn";
import type { VisualFrame } from "@/types";

type Input = { value: number; advantages: number[] };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Dueling DQN", () => {
    it("centers advantages so the mean Q equals the state value", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meanAdvantage = input.advantages.reduce((a, v) => a + v, 0) / input.advantages.length;
        const expectedQ = input.advantages.map((a) => input.value + (a - meanAdvantage));
        const final = frames[frames.length - 1]?.meta;
        const qValues = final?.["qValues"] as number[];
        expectedQ.forEach((value, i) => expect(qValues[i]).toBeCloseTo(value, 6));
        const centered = frames.find((f) => Array.isArray(f.meta["centered"]))?.meta["centered"] as number[];
        expect(centered.reduce((a, v) => a + v, 0)).toBeCloseTo(0, 6);
        const meanQ = qValues.reduce((a, v) => a + v, 0) / qValues.length;
        expect(meanQ).toBeCloseTo(input.value, 6);
    });

    it("works for a single action and for all-equal advantages", () => {
        const single = [...mod.run({ value: 4, advantages: [2] })];
        expect((single[single.length - 1]?.meta["qValues"] as number[])[0]).toBeCloseTo(4, 6);
        const equal = [...mod.run({ value: 1, advantages: [3, 3, 3] })];
        const q = equal[equal.length - 1]?.meta["qValues"] as number[];
        q.forEach((v) => expect(v).toBeCloseTo(1, 6));
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
