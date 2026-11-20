/**
 * wiener-filter.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./wiener-filter";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], bins: number): void {
    expect(frames.length).toBe(bins + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bins);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Wiener Filter", () => {
    it("computes the exact per-bin gain and minimum error", () => {
        const input = mod.defaultInput as { signalPower: number[]; noisePower: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.signalPower.length);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["done"]).toBe(true);
        const gain = last?.["gain"] as number[];
        const error = last?.["errorPower"] as number[];
        let totalExpected = 0;
        for (let index = 0; index < input.signalPower.length; index += 1) {
            const s = input.signalPower[index] ?? 0;
            const n = input.noisePower[index] ?? 0;
            expect(gain[index]).toBeCloseTo(s / (s + n), 12);
            expect(error[index]).toBeCloseTo((s * n) / (s + n), 12);
            expect(gain[index] as number).toBeGreaterThanOrEqual(0);
            expect(gain[index] as number).toBeLessThanOrEqual(1);
            totalExpected += (s * n) / (s + n);
        }
        expect(last?.["totalError"] as number).toBeCloseTo(totalExpected, 12);
    });

    it("handles a zero-signal and zero-noise bin", () => {
        const input = { signalPower: [0, 5], noisePower: [3, 0] };
        const frames = [...mod.run(input)];
        const gain = frames[frames.length - 1]?.meta["gain"] as number[];
        expect(gain[0]).toBe(0);
        expect(gain[1]).toBe(1);
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
