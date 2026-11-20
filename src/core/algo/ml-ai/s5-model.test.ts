/** s5-model.test.ts - Discretization, recurrence, linearity, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { s5Discrete, s5Scan, s5Step } from "./s5-model";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("S5 model", () => {
    it("discretization matches the exact zero-order-hold formula", () => {
        const { aBar, bBar } = s5Discrete(-2, 3, 0.25);
        const expected = Math.exp(-0.5);
        expect(aBar).toBeCloseTo(expected, 12);
        expect(bBar).toBeCloseTo(((expected - 1) / -2) * 3, 12);
        expect(s5Discrete(0, 4, 0.5).bBar).toBeCloseTo(2, 12);
    });

    it("one step matches a brute-force sequential expansion", () => {
        const state = [0.5, -0.4, 0.2];
        const aBar = [0.8, 0.9, 0.7];
        const bBar = [0.1, 0.2, 0.3];
        const C = [1, 2, 3];
        const u = 1.5;
        const result = s5Step(state, aBar, bBar, u, C, 0.1);
        const expectedState = state.map((s, i) => s * (aBar[i] ?? 0) + (bBar[i] ?? 0) * u);
        const expectedOut = 0.1 * u + expectedState.reduce((sum, s, i) => sum + s * (C[i] ?? 0), 0);
        result.state.forEach((s, i) => expect(s).toBeCloseTo(expectedState[i] ?? 0, 12));
        expect(result.output).toBeCloseTo(expectedOut, 12);
    });

    it("is linear in the input when the step size is fixed", () => {
        const base = { diagA: [-1, -2], B: [1, 1], C: [1, 0.5], D: 0, dt: 0.2, dtSlope: 0 };
        const a = s5Scan({ ...base, sequence: [1, -0.5, 2] });
        const b = s5Scan({ ...base, sequence: [2, -1, 4] });
        a.outputs.forEach((y, i) => expect(y * 2).toBeCloseTo(b.outputs[i] ?? 0, 10));
    });

    it("produces finite trajectories and well-formed frames", () => {
        const input = mod.defaultInput as Parameters<typeof s5Scan>[0];
        const result = s5Scan(input);
        expect(result.states.length).toBe(input.sequence?.length ?? 6);
        result.outputs.forEach((y) => expect(Number.isFinite(y)).toBe(true));
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
