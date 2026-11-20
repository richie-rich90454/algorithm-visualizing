/** zeroquant.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { zeroQuantize } from "./zeroquant";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ZeroQuant", () => {
    it("matches an independent group-wise quantization", () => {
        const input = mod.defaultInput as { weights: number[]; groupSize: number; bits: number };
        const { weights, groupSize, bits } = input;
        const result = zeroQuantize(weights, groupSize, bits);
        const frames = [...mod.run(input)];
        checkFrames(frames, weights.length);

        const maxLevel = (1 << bits) - 1;
        const expectedScales: number[] = [];
        const expectedLevels: number[] = [];
        const expectedDequant: number[] = [];
        for (let start = 0; start < weights.length; start += groupSize) {
            const group = weights.slice(start, start + groupSize);
            const min = Math.min(...group);
            const max = Math.max(...group);
            const scale = (max - min) / maxLevel || 1;
            expectedScales.push(scale);
            group.forEach((w) => {
                const level = Math.max(0, Math.min(maxLevel, Math.round((w - min) / scale)));
                expectedLevels.push(level);
                expectedDequant.push(min + level * scale);
            });
        }
        expect(result.scales).toEqual(expectedScales);
        expect(result.levels).toEqual(expectedLevels);
        result.dequantized.forEach((v, i) => expect(v).toBeCloseTo(expectedDequant[i], 10));

        result.levels.forEach((level) => {
            expect(level).toBeGreaterThanOrEqual(0);
            expect(level).toBeLessThanOrEqual(maxLevel);
        });
        result.dequantized.forEach((v, i) => {
            const scale = result.scales[Math.floor(i / groupSize)];
            expect(Math.abs(v - weights[i])).toBeLessThanOrEqual(scale / 2 + 1e-9);
        });
        const expectedMse = weights.reduce((s, w, i) => s + (w - expectedDequant[i]) ** 2, 0) / weights.length;
        expect(result.meanSquaredError).toBeCloseTo(expectedMse, 10);
    });

    it("uses more bits to reduce error", () => {
        const weights = [0.12, 0.31, -0.08, 0.55, -1.2, -0.95, 0.02, 0.44];
        const low = zeroQuantize(weights, 4, 2).meanSquaredError;
        const high = zeroQuantize(weights, 4, 6).meanSquaredError;
        expect(high).toBeLessThanOrEqual(low);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
