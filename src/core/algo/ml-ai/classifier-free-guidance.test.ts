/**
 * classifier-free-guidance.test.ts - Guidance blend correctness, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./classifier-free-guidance";
import type { VisualFrame } from "@/types";

function reference(uncond: number[][], cond: number[][], scale: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < Math.min(uncond.length, cond.length); i += 1) {
        const base = uncond[i] ?? [];
        const target = cond[i] ?? [];
        for (let d = 0; d < Math.min(base.length, target.length); d += 1) {
            const u = base[d] ?? 0;
            out.push(u + scale * ((target[d] ?? 0) - u));
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], dim: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dim);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Classifier-free guidance", () => {
    it("blends predictions exactly as the formula states", () => {
        const input = mod.defaultInput as { uncond: number[][]; cond: number[][]; scale: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, (input.uncond[0] ?? []).length);
        const guided = frames[frames.length - 1]?.meta["guidedFlat"] as number[];
        const expected = reference(input.uncond, input.cond, input.scale);
        expect(guided).toHaveLength(expected.length);
        expected.forEach((value, i) => expect(guided[i]).toBeCloseTo(value, 9));
    });

    it("reduces to the unconditional and conditional predictions at scales zero and one", () => {
        const uncond = [[1, 2, 3]];
        const cond = [[4, 5, 6]];
        const atZero = [...mod.run({ uncond, cond, scale: 0 })].pop()?.meta["guidedFlat"] as number[];
        const atOne = [...mod.run({ uncond, cond, scale: 1 })].pop()?.meta["guidedFlat"] as number[];
        expect(atZero).toEqual([1, 2, 3]);
        expect(atOne).toEqual([4, 5, 6]);
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
