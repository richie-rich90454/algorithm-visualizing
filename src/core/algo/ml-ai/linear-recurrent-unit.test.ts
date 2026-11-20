/** linear-recurrent-unit.test.ts - Closed-form recurrence equivalence, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { lruClosedFormState, lruRun } from "./linear-recurrent-unit";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Linear Recurrent Unit", () => {
    it("the recurrence equals the unrolled closed form", () => {
        for (const [seq, a, b] of [
            [[1, 0.5, -0.5, 1], 0.8, 1],
            [[2, -1, 3], -0.5, 0.7],
            [[0, 0, 0], 0.9, 2],
        ] as Array<[number[], number, number]>) {
            const { states } = lruRun(seq, a, b, 1, 0);
            const closed = lruClosedFormState(seq, a, b);
            states.forEach((value, i) => expect(value).toBeCloseTo(closed[i] ?? 0, 12));
        }
    });

    it("computes the correct outputs from states and inputs", () => {
        const seq = [1, 0.5, -0.5];
        const { states, outputs } = lruRun(seq, 0.8, 1, 2, -0.3);
        outputs.forEach((value, i) => expect(value).toBeCloseTo(2 * (states[i] ?? 0) - 0.3 * (seq[i] ?? 0), 12));
    });

    it("emits well-formed frames whose final meta matches the reference", () => {
        const input = mod.defaultInput as { sequence: number[]; a: number; b: number; c: number; d: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = lruRun(input.sequence, input.a, input.b, input.c, input.d);
        const final = frames[frames.length - 1]?.meta;
        (final?.["states"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.states[i] ?? 0, 10));
        (final?.["outputs"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.outputs[i] ?? 0, 10));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
