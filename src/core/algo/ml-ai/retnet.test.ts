/**
 * retnet.test.ts - Retention recurrence versus parallel form, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./retnet";
import type { VisualFrame } from "@/types";

/** Independent parallel form: sum over earlier positions of gamma^(t-i) q_t k_i v_i. */
function reference(q: number[], k: number[], v: number[], gamma: number): number[] {
    const n = Math.min(q.length, k.length, v.length);
    const out: number[] = [];
    for (let t = 0; t < n; t += 1) {
        let sum = 0;
        for (let i = 0; i <= t; i += 1) {
            sum += Math.pow(gamma, t - i) * (q[t] ?? 0) * (k[i] ?? 0) * (v[i] ?? 0);
        }
        out.push(sum);
    }
    return out;
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

describe("RetNet retention", () => {
    it("recurrent outputs equal the parallel form", () => {
        const input = mod.defaultInput as { q: number[]; k: number[]; v: number[]; gamma: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.q.length);
        const outputs = frames[frames.length - 1]?.meta["outputs"] as number[];
        const expected = reference(input.q, input.k, input.v, input.gamma);
        expect(outputs).toHaveLength(expected.length);
        expected.forEach((value, i) => expect(outputs[i]).toBeCloseTo(value, 9));
    });

    it("matches the parallel form for other decay values", () => {
        const cases = [
            { q: [1, 1, 1], k: [1, 2, 3], v: [2, 1, 4], gamma: 1 },
            { q: [2, 0, 3, 1], k: [1, 1, 1, 1], v: [1, 2, 3, 4], gamma: 0.25 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const outputs = frames[frames.length - 1]?.meta["outputs"] as number[];
            const expected = reference(input.q, input.k, input.v, input.gamma);
            expected.forEach((value, i) => expect(outputs[i]).toBeCloseTo(value, 9));
        }
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
