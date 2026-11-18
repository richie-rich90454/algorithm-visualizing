/**
 * simons-problem.test.ts - Brute-force hidden-mask recovery, orthogonality,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./simons-problem";
import type { VisualFrame } from "@/types";

function parityAnd(a: number, b: number): number {
    let value = a & b;
    let parity = 0;
    while (value !== 0) {
        parity ^= 1;
        value &= value - 1;
    }
    return parity;
}

function checkFrames(frames: VisualFrame[], bits: number, sampleCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe((sampleCount + 1) * bits);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(sampleCount + 1);
        expect(frame.meta["cols"]).toBe(bits);
    });
}

describe("SimonsProblem", () => {
    it("recovers every hidden mask by brute force over all masks", () => {
        for (const bits of [2, 3, 4]) {
            const size = 1 << bits;
            for (let hidden = 1; hidden < size; hidden += 1) {
                const frames = [...mod.run({ bits, hidden })];
                const final = frames[frames.length - 1]?.meta;
                const samples = final?.["samples"] as number[];
                checkFrames(frames, bits, samples.length);
                expect(final?.["recovered"]).toBe(hidden);
                expect(final?.["valid"]).toBe(true);
                expect(final?.["rank"]).toBe(bits - 1);

                for (const y of samples) {
                    expect(parityAnd(y, hidden)).toBe(0);
                }
                const oracle = (x: number) => Math.min(x, x ^ hidden);
                for (let x = 0; x < size; x += 1) {
                    expect(oracle(x)).toBe(oracle(x ^ hidden));
                }
            }
        }
    });

    it("makes every sampled row satisfy the parity equation", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const samples = final?.["samples"] as number[];
        const recovered = Number(final?.["recovered"]);
        for (const frame of frames) {
            const visible = frame.meta["samples"] as number[];
            for (const y of visible) {
                expect(parityAnd(y, recovered)).toBe(0);
            }
        }
        expect(samples.length).toBe(2);
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
