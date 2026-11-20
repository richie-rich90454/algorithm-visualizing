/**
 * affine-projection.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./affine-projection";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], order: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(order);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["weights"])).toBe(true);
    });
}

describe("Affine Projection Filter", () => {
    it("identifies the true system weights", () => {
        const input = mod.defaultInput as { trueWeights: number[]; order: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.order);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["done"]).toBe(true);
        const weights = last?.["weights"] as number[];
        const truth = input.trueWeights;
        for (let tap = 0; tap < truth.length; tap += 1) {
            expect(weights[tap]).toBeCloseTo(truth[tap] as number, 2);
        }
    });

    it("makes progress from the zero initialization", () => {
        const input = mod.defaultInput as { trueWeights: number[]; order: number };
        const frames = [...mod.run(input)];
        const first = frames[0]?.meta["weights"] as number[];
        const last = frames[frames.length - 1]?.meta["weights"] as number[];
        expect(first.every((value) => value === 0)).toBe(true);
        const errorBefore = first.reduce((sum, value, index) => sum + Math.abs(value - (input.trueWeights[index] ?? 0)), 0);
        const errorAfter = last.reduce((sum, value, index) => sum + Math.abs(value - (input.trueWeights[index] ?? 0)), 0);
        expect(errorAfter).toBeLessThan(errorBefore);
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
