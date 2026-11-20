/**
 * zero-noise-extrapolation.test.ts - Closed-form reference, exactness, monotonicity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./zero-noise-extrapolation";
import type { VisualFrame } from "@/types";

function referenceExpectation(theta: number, noise: number, gates: number, scale: number): number {
    return Math.cos(theta) * Math.pow(1 - scale * noise, gates);
}

function referenceExtrapolation(values: number[]): number {
    const scales = [1, 2, 3];
    let result = 0;
    for (let i = 0; i < scales.length; i += 1) {
        let weight = 1;
        for (let j = 0; j < scales.length; j += 1) {
            if (i === j) continue;
            weight *= (0 - scales[j]!) / (scales[i]! - scales[j]!);
        }
        result += weight * values[i]!;
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["scales"] as number[])).toEqual([1, 2, 3]);
    });
}

describe("ZeroNoiseExtrapolation", () => {
    it("matches a closed-form noisy expectation reference", () => {
        const cases = [
            { theta: 0.6, noise: 0.05, gates: 2 },
            { theta: 1.2, noise: 0.1, gates: 3 },
            { theta: -0.4, noise: 0.02, gates: 1 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expectations = final?.["expectations"] as number[];
            [1, 2, 3].forEach((scale, i) => {
                expect(expectations[i]).toBeCloseTo(referenceExpectation(input.theta, input.noise, input.gates, scale), 12);
            });
            expect(final?.["extrapolated"] as number).toBeCloseTo(referenceExtrapolation(expectations), 12);
        }
    });

    it("recovers the ideal value exactly for two noise layers", () => {
        for (const theta of [-1.1, -0.3, 0, 0.6, 1.4]) {
            const final = [...mod.run({ theta, noise: 0.07, gates: 2 })].pop()?.meta;
            expect(final?.["extrapolated"] as number).toBeCloseTo(Math.cos(theta), 11);
            expect(final?.["error"] as number).toBeLessThan(1e-10);
            expect(final?.["ideal"] as number).toBeCloseTo(Math.cos(theta), 12);
        }
    });

    it("reduces bias relative to the raw measurement and is monotone in noise", () => {
        const final = [...mod.run({ theta: 0.6, noise: 0.1, gates: 2 })].pop()?.meta;
        expect(final?.["rawError"] as number).toBeGreaterThan(final?.["error"] as number);
        const values = final?.["expectations"] as number[];
        expect(values[0]).toBeGreaterThan(values[1]!);
        expect(values[1]).toBeGreaterThan(values[2]!);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
