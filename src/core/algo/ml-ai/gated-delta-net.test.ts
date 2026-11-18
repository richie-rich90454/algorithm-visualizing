/**
 * gated-delta-net.test.ts - Independent recurrence check, zero-write property,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gated-delta-net";
import type { VisualFrame } from "@/types";

interface Input {
    keys: number[][];
    values: number[][];
    queries: number[][];
    alpha: number;
    beta: number;
}

function checkFrames(frames: VisualFrame[], d: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(d * d);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent replay of the gated delta recurrence. */
function reference(input: Input) {
    const d = input.keys[0]?.length ?? 2;
    let state: number[][] = Array.from({ length: d }, () => Array(d).fill(0));
    const outputs: number[][] = [];
    const states: number[][] = [];
    for (let t = 0; t < input.keys.length; t += 1) {
        const key = input.keys[t] ?? [];
        const value = input.values[t] ?? [];
        const query = input.queries[t] ?? [];
        outputs.push(
            state.map((row) => row.reduce((sum, x, k) => sum + x * (query[k] ?? 0), 0)),
        );
        const predicted = state.map((row) => row.reduce((sum, x, k) => sum + x * (key[k] ?? 0), 0));
        const delta = value.map((v, i) => v - (predicted[i] ?? 0));
        state = state.map((row, i) =>
            row.map((x, j) => input.alpha * x + input.beta * (delta[i] ?? 0) * (key[j] ?? 0)),
        );
        states.push(state.reduce<number[]>((acc, row) => acc.concat(row), []));
    }
    return { outputs, states };
}

describe("Gated Delta Net", () => {
    it("matches an independent delta-rule replay at every token", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        const expected = reference(input);

        expect(frames[0]?.meta["state"]).toEqual(Array(4).fill(0));
        for (let t = 0; t < input.keys.length; t += 1) {
            const frame = frames[t + 1];
            expect(frame?.meta["t"]).toBe(t);
            expect(frame?.meta["state"]).toEqual(expected.states[t]);
            (frame?.meta["output"] as number[]).forEach((value, i) => {
                expect(value).toBeCloseTo(expected.outputs[t]?.[i] ?? 0, 8);
            });
        }
    });

    it("keeps the state zero when the write gate is zero", () => {
        const input = { ...(mod.defaultInput as Input), beta: 0 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        frames.forEach((frame) => {
            expect(frame.meta["state"]).toEqual(Array(4).fill(0));
            expect(frame.meta["output"] as number[]).toEqual(Array(2).fill(0));
        });
    });

    it("decays a written entry when the write gate is zero afterward", () => {
        const base = mod.defaultInput as Input;
        const oneStep = [...mod.run({ ...base, beta: 1, alpha: 1, queries: base.queries.slice(0, 1), keys: base.keys.slice(0, 1), values: base.values.slice(0, 1) })];
        const stateAfterFirst = oneStep[1]?.meta["state"] as number[];
        expect(stateAfterFirst[0]).toBeCloseTo(0.5, 8);

        const decayed = [...mod.run({ ...base, alpha: 0.5, beta: 0 })];
        expect(decayed[decayed.length - 1]?.meta["state"]).toEqual(Array(4).fill(0));
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
