/**
 * z-transform.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./z-transform";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["coefficients"])).toBe(true);
    });
}

describe("Z-Transform", () => {
    it("evaluates the polynomial correctly at every sample point", () => {
        const input = mod.defaultInput as { sequence: number[]; zPoints: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["done"]).toBe(true);
        const evaluations = last?.["evaluations"] as number[];
        expect(evaluations).toHaveLength(input.zPoints.length);
        for (let point = 0; point < input.zPoints.length; point += 1) {
            const z = input.zPoints[point] as number;
            let expected = 0;
            for (let n = 0; n < input.sequence.length; n += 1) {
                expected += (input.sequence[n] as number) / z ** n;
            }
            expect(evaluations[point]).toBeCloseTo(expected, 10);
        }
    });

    it("matches the Horner accumulator and coefficients to the sequence", () => {
        const input = mod.defaultInput as { sequence: number[]; zPoints: number[] };
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["coefficients"]).toEqual(input.sequence);
        const hornerFrame = frames.find((frame) => frame.meta["hornerIndex"] === 0);
        const evaluations = last?.["evaluations"] as number[];
        expect(hornerFrame?.meta["accumulator"] as number).toBeCloseTo(evaluations[0] as number, 10);
    });

    it("obeys the shift property: shifting right prepends a zero", () => {
        const shifted = [...mod.run({ sequence: [0, 1, 2, 3, 4], zPoints: [2] })];
        const coefficients = shifted[shifted.length - 1]?.meta["coefficients"] as number[];
        expect(coefficients).toEqual([0, 1, 2, 3, 4]);
        const original = [...mod.run({ sequence: [1, 2, 3, 4], zPoints: [2] })];
        const originalEvaluations = original[original.length - 1]?.meta["evaluations"] as number[];
        const shiftedEvaluations = shifted[shifted.length - 1]?.meta["evaluations"] as number[];
        expect(shiftedEvaluations[0]).toBeCloseTo(originalEvaluations[0] as number / 2, 10);
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
