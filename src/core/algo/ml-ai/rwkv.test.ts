/**
 * rwkv.test.ts - Recurrence versus direct sum, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rwkv";
import type { VisualFrame } from "@/types";

/** Direct causal attention with exponential decay, computed without recurrence. */
function reference(keys: number[], values: number[], decay: number): number[] {
    const outputs: number[] = [];
    for (let t = 0; t < keys.length; t += 1) {
        let num = 0;
        let den = 0;
        for (let i = 0; i <= t; i += 1) {
            const weight = Math.exp(decay * (t - i) + (keys[i] ?? 0));
            num += weight * (values[i] ?? 0);
            den += weight;
        }
        outputs.push(num / den);
    }
    return outputs;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(5 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("RWKV", () => {
    it("matches the direct sum for several decays", () => {
        const input = mod.defaultInput as { keys: number[]; values: number[] };
        for (const decay of [0, -0.1, -0.5, -1, -2]) {
            const frames = [...mod.run({ ...input, decay })];
            checkFrames(frames, input.keys.length);
            const outputs = (frames[frames.length - 1]?.meta["outputs"] as string[]).map(Number);
            const expected = reference(input.keys, input.values, decay);
            expect(outputs.length).toBe(expected.length);
            expected.forEach((value, t) => {
                expect(outputs[t] ?? 0).toBeCloseTo(value, 2);
            });
        }
    });

    it("keeps every output a weighted average inside the value range", () => {
        const keys = [0.3, -0.7, 0.2, 0.9];
        const values = [2, -1, 5, 0];
        const frames = [...mod.run({ keys, values, decay: -0.4 })];
        checkFrames(frames, keys.length);
        const outputs = (frames[frames.length - 1]?.meta["outputs"] as string[]).map(Number);
        for (let t = 0; t < outputs.length; t += 1) {
            const seen = values.slice(0, t + 1);
            expect(outputs[t] ?? 0).toBeGreaterThanOrEqual(Math.min(...seen) - 1e-6);
            expect(outputs[t] ?? 0).toBeLessThanOrEqual(Math.max(...seen) + 1e-6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
