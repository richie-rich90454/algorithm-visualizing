/**
 * normal-distribution-cdf-approximation.test.ts - Known values, independent erf
 * reference, symmetry and monotonicity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./normal-distribution-cdf-approximation";
import type { VisualFrame } from "@/types";

/** Independent error-function approximation, Abramowitz and Stegun 7.1.26. */
function erfReference(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const polynomial =
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    return sign * (1 - polynomial * Math.exp(-ax * ax));
}

function phiFromModule(z: number): number {
    const frames = [...mod.run({ z, samples: 9 })];
    return Number(frames[frames.length - 1]?.meta["phi"]);
}

function checkFrames(frames: VisualFrame[], samples: number): void {
    expect(frames.length).toBe(9);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(samples);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("normal distribution CDF approximation", () => {
    it("matches standard table values to seven decimals", () => {
        const known: Array<[number, number]> = [
            [0, 0.5],
            [1, 0.8413447],
            [2, 0.9772499],
            [3, 0.9986501],
            [-1, 0.1586553],
            [-2, 0.0227501],
        ];
        for (const [z, expected] of known) {
            expect(phiFromModule(z)).toBeCloseTo(expected, 6);
        }
    });

    it("agrees with an independent erf reference across the range", () => {
        for (let z = -4; z <= 4; z += 0.25) {
            const want = 0.5 * (1 + erfReference(z / Math.SQRT2));
            expect(phiFromModule(z)).toBeCloseTo(want, 6);
        }
    });

    it("is symmetric and monotone on its tabulated grid", () => {
        const frames = [...mod.run({ z: 1.3, samples: 41 })];
        checkFrames(frames, 41);
        const grid = frames[0]?.meta["grid"] as number[];
        const values = frames[0]?.meta["values"] as number[];
        for (let i = 1; i < values.length; i += 1) {
            expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
        }
        for (let i = 0; i < grid.length; i += 1) {
            const mirrorIndex = grid.length - 1 - i;
            expect(values[i]! + values[mirrorIndex]!).toBeCloseTo(1, 6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(9);
        expect(generator.next().done).toBe(true);
    });
});
