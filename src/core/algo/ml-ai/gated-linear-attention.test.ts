/** gated-linear-attention.test.ts - Unrolled closed form, gates, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { glaForward } from "./gated-linear-attention";
import type { VisualFrame } from "@/types";

/** Independent unrolled expansion of the gated outer-product recurrence. */
function reference(keys: number[][], values: number[][], gates: number[][], queries: number[][]) {
    const dk = keys[0]?.length ?? 1;
    const dv = values[0]?.length ?? 1;
    const states: number[][][] = [];
    const outputs: number[][] = [];
    for (let t = 0; t < keys.length; t += 1) {
        const state: number[][] = Array.from({ length: dk }, () => new Array<number>(dv).fill(0));
        for (let r = 0; r <= t; r += 1) {
            for (let i = 0; i < dk; i += 1) {
                let surviving = 1;
                for (let m = r + 1; m <= t; m += 1) surviving *= gates[m]?.[i] ?? 1;
                for (let j = 0; j < dv; j += 1) {
                    state[i]![j] += surviving * (keys[r]?.[i] ?? 0) * (values[r]?.[j] ?? 0);
                }
            }
        }
        states.push(state);
        outputs.push(Array.from({ length: dv }, (_, j) =>
            state.reduce((sum, row, i) => sum + row[j]! * (queries[t]?.[i] ?? 0), 0)));
    }
    return { states, outputs };
}

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

describe("Gated linear attention", () => {
    it("matches an independent unrolled expansion", () => {
        const input = mod.defaultInput as {
            keys: number[][]; values: number[][]; queries: number[][]; forgetGates: number[][];
        };
        const got = glaForward(input.keys, input.values, input.queries, input.forgetGates);
        const expected = reference(input.keys, input.values, input.forgetGates, input.queries);
        got.states.forEach((matrix, t) => matrix.forEach((row, i) => row.forEach((v, j) =>
            expect(v).toBeCloseTo(expected.states[t]![i]![j]!, 10))));
        got.outputs.forEach((row, t) => row.forEach((v, j) =>
            expect(v).toBeCloseTo(expected.outputs[t]![j]!, 10)));
    });

    it("a zero forget gate keeps only the most recent write", () => {
        const keys = [[1], [2], [3]];
        const values = [[4], [5], [6]];
        const queries = [[1], [1], [1]];
        const gates = [[0], [0], [0]];
        const { outputs } = glaForward(keys, values, queries, gates);
        expect(outputs[0]?.[0]).toBeCloseTo(1 * 4, 10);
        expect(outputs[1]?.[0]).toBeCloseTo(2 * 5, 10);
        expect(outputs[2]?.[0]).toBeCloseTo(3 * 6, 10);
    });

    it("emits well-formed frames and terminates", () => {
        const input = mod.defaultInput as Parameters<typeof glaForward>[0] & { T?: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
