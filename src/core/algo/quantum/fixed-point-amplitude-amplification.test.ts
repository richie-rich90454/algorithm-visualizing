/**
 * fixed-point-amplitude-amplification.test.ts - Closed-form cubic law, monotonicity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fixed-point-amplitude-amplification";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], iterations: number): void {
    expect(frames.length).toBe(iterations + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        frame.entities.forEach((e) => {
            const p = e.value as number;
            expect(p).toBeGreaterThanOrEqual(0);
            expect(p).toBeLessThanOrEqual(1);
        });
    });
}

describe("FixedPointAmplitudeAmplification", () => {
    it("follows the closed-form cubic error law", () => {
        for (const goodFraction of [0.25, 0.1, 0.7, 0.5]) {
            const iterations = 6;
            const frames = [...mod.run({ goodFraction, iterations })];
            checkFrames(frames, iterations);
            const bad0 = 1 - goodFraction;
            frames.forEach((frame, index) => {
                const k = index === 0 ? 0 : index <= iterations ? index : iterations;
                const expectedBad = bad0 ** 3 ** k;
                expect(frame.meta["badProbability"] as number).toBeCloseTo(expectedBad, 12);
                expect(frame.meta["goodProbability"] as number).toBeCloseTo(1 - expectedBad, 12);
            });
        }
    });

    it("increases good probability monotonically with no overshoot", () => {
        const frames = [...mod.run({ goodFraction: 0.05, iterations: 10 })];
        let previous = 0;
        for (const frame of frames) {
            const good = frame.meta["goodProbability"] as number;
            expect(good).toBeGreaterThanOrEqual(previous);
            expect(good).toBeLessThanOrEqual(1);
            previous = good;
        }
        expect(previous).toBeGreaterThan(0.999);
    });

    it("keeps the bar history consistent with the probabilities", () => {
        const frames = [...mod.run({ goodFraction: 0.3, iterations: 5 })];
        for (let k = 0; k <= 5; k += 1) {
            const frame = frames[k];
            expect(frame?.entities).toHaveLength(k + 1);
            const lastBar = frame?.entities[frame.entities.length - 1];
            expect(lastBar?.value).toBeCloseTo(frame?.meta["goodProbability"] as number, 12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
