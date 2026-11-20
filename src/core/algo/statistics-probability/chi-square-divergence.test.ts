/**
 * chi-square-divergence.test.ts - Independent divergence sum, nonnegativity,
 * symmetry failure, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./chi-square-divergence";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], m: number): void {
    expect(frames.length).toBe(m + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(m);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["bins"]).toBe(m);
    });
}

function divergenceFromMeta(meta: VisualFrame["meta"]): number {
    const p = meta["p"] as number[];
    const q = meta["q"] as number[];
    let total = 0;
    for (let i = 0; i < p.length; i += 1) {
        total += ((p[i] ?? 0) - (q[i] ?? 0)) ** 2 / (q[i] ?? 1e-9);
    }
    return total;
}

describe("ChiSquareDivergence", () => {
    it("matches an independent sum over the displayed distributions", () => {
        const input = mod.defaultInput as { p: number[]; q: number[] };
        const frames = [...mod.run(input)];
        const m = Math.max(input.p.length, input.q.length);
        checkFrames(frames, m);
        const meta = frames[frames.length - 1]!.meta;
        expect(Number(meta["divergence"])).toBeCloseTo(divergenceFromMeta(meta), 10);
        expect((meta["p"] as number[]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        expect((meta["q"] as number[]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    it("is nonnegative, near zero for matching inputs, and asymmetric", () => {
        const same = [...mod.run({ p: [0.5, 0.3, 0.2], q: [0.5, 0.3, 0.2] })].at(-1)!.meta;
        expect(Number(same["divergence"])).toBeCloseTo(0, 6);
        const forward = [...mod.run({ p: [0.6, 0.3, 0.1], q: [0.2, 0.3, 0.5] })].at(-1)!.meta;
        const backward = [...mod.run({ p: [0.2, 0.3, 0.5], q: [0.6, 0.3, 0.1] })].at(-1)!.meta;
        expect(Number(forward["divergence"])).toBeGreaterThan(0);
        expect(Number(backward["divergence"])).toBeGreaterThan(0);
        expect(Number(forward["divergence"])).not.toBeCloseTo(Number(backward["divergence"]), 3);
    });

    it("accumulates nonnegative per-bin contributions", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (const frame of frames) {
            const contributions = frame.meta["contributions"] as number[];
            for (const value of contributions) expect(value).toBeGreaterThanOrEqual(0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
