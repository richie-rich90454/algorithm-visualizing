/**
 * rslora.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./rslora";
import type { VisualFrame } from "@/types";

type Input = { rank: number; alpha: number; A: number[][]; B: number[][] };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function bruteForceDelta(B: number[][], A: number[][], scale: number): number[][] {
    return B.map((row) =>
        (A[0] ?? []).map((_, j) => row.reduce((sum, value, t) => sum + value * (A[t]?.[j] ?? 0), 0) * scale),
    );
}

describe("Rank-Stabilized LoRA", () => {
    it("uses the square-root scale and matches a brute-force matrix product", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const scale = input.alpha / Math.sqrt(input.rank);
        expect(Number(final?.["scale"])).toBeCloseTo(scale, 6);
        const expectedDelta = bruteForceDelta(input.B, input.A, scale);
        const delta = final?.["delta"] as number[];
        let index = 0;
        expectedDelta.forEach((row) => row.forEach((value) => {
            expect(delta[index]).toBeCloseTo(value, 5);
            index += 1;
        }));
    });

    it("scale grows with the square root of rank, not linearly", () => {
        const base = { alpha: 8, A: [[1, 0], [0, 1]], B: [[1, 0], [0, 1]] };
        const r2 = [...mod.run({ ...base, rank: 2 })][0]?.meta["scale"] as number;
        const r8 = [...mod.run({ ...base, rank: 8 })][0]?.meta["scale"] as number;
        expect(r8).toBeCloseTo(r2 / 2, 6);
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
