/**
 * lora.test.ts - Low-rank merge correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lora";
import type { VisualFrame } from "@/types";

/** Independent dense reference for W + B times A. */
function reference(W: number[][], B: number[][], A: number[][]): number[] {
    const out: number[] = [];
    for (let i = 0; i < W.length; i += 1) {
        for (let j = 0; j < (W[i]?.length ?? 0); j += 1) {
            let delta = 0;
            for (let k = 0; k < (B[0]?.length ?? 0); k += 1) {
                delta += (B[i]?.[k] ?? 0) * (A[k]?.[j] ?? 0);
            }
            out.push((W[i]?.[j] ?? 0) + delta);
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], cells: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(cells);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("LoRA merge", () => {
    it("computes W + B times A exactly", () => {
        const input = mod.defaultInput as { W: number[][]; B: number[][]; A: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.W.length * (input.W[0]?.length ?? 0));
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["mergedFlat"]).toEqual(reference(input.W, input.B, input.A));
        expect(final?.["fullParams"]).toBe(6);
        expect(final?.["loraParams"]).toBe(10);
    });

    it("matches the reference on a different rank and shape", () => {
        const input = {
            W: [[10, 20], [30, 40], [50, 60]],
            B: [[1, 2], [3, 4], [5, 6]],
            A: [[1, 0], [0, 1]],
        };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["mergedFlat"]).toEqual(reference(input.W, input.B, input.A));
        expect(final?.["loraParams"]).toBe(3 * 2 + 2 * 2);
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
