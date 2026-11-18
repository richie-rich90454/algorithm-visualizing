/**
 * lstm.test.ts - LSTM cell equations correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lstm";
import type { VisualFrame } from "@/types";

const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/** Independent scalar LSTM cell computation. */
function reference(sequence: number[], w: number[], b: number[], h0: number, c0: number) {
    let h = h0;
    let c = c0;
    const outputs: number[] = [];
    const gateLog: Array<{ f: number; i: number; o: number; g: number }> = [];
    for (const x of sequence) {
        const combined = h + x;
        const f = sigmoid(w[0]! * combined + b[0]!);
        const i = sigmoid(w[1]! * combined + b[1]!);
        const o = sigmoid(w[2]! * combined + b[2]!);
        const g = Math.tanh(w[3]! * combined + b[3]!);
        c = f * c + i * g;
        h = o * Math.tanh(c);
        outputs.push(h);
        gateLog.push({ f, i, o, g });
    }
    return { h, c, outputs, gateLog };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("LSTM cell step", () => {
    it("matches the standard cell equations", () => {
        const input = mod.defaultInput as {
            sequence: number[];
            weights: number[];
            biases: number[];
            h0: number;
            c0: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.sequence.length);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.sequence, input.weights, input.biases, input.h0, input.c0);
        const outputs = final?.["outputs"] as number[];
        expected.outputs.forEach((value, i) => expect(outputs[i]).toBeCloseTo(value, 9));
        expect(Number(final?.["h"])).toBeCloseTo(expected.h, 9);
        expect(Number(final?.["c"])).toBeCloseTo(expected.c, 9);
        expect(Number(final?.["i"])).toBeGreaterThan(0);
        expect(Number(final?.["f"])).toBeLessThan(1);
    });

    it("matches the equations with nonzero biases and initial state", () => {
        const input = {
            sequence: [0.2, -0.4, 0.9],
            weights: [1.2, 0.8, 1.1, 0.7],
            biases: [0.1, -0.2, 0.3, 0],
            h0: 0.5,
            c0: -0.25,
        };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.sequence, input.weights, input.biases, input.h0, input.c0);
        const outputs = final?.["outputs"] as number[];
        expected.outputs.forEach((value, i) => expect(outputs[i]).toBeCloseTo(value, 9));
        expect(Number(final?.["c"])).toBeCloseTo(expected.c, 9);
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
