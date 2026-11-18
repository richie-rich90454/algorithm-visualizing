/**
 * laplace-mechanism-differential-privacy.test.ts - Inverse-CDF check, DP bound, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./laplace-mechanism-differential-privacy";
import type { VisualFrame } from "@/types";

/** Independent seeded generator and Laplace inverse-CDF computation. */
function referenceNoise(seed: number, scale: number, count: number): number[] {
    let state = seed >>> 0;
    const next = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
    const out: number[] = [];
    for (let i = 0; i < count; i += 1) {
        const u = next();
        const centered = u - 0.5;
        out.push(-scale * Math.sign(centered) * Math.log(1 - 2 * Math.abs(centered)));
    }
    return out;
}

function checkFrames(frames: VisualFrame[], samples: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(samples);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("LaplaceMechanismDifferentialPrivacy", () => {
    it("matches an independent inverse-CDF implementation", () => {
        const input = mod.defaultInput as { trueValue: number; sensitivity: number; epsilon: number; seed: number; samples: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.samples);
        const scale = input.sensitivity / input.epsilon;
        const expected = referenceNoise(input.seed, scale, input.samples);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["scale"])).toBeCloseTo(scale, 10);
        const noise = final?.["noise"] as number[];
        expect(noise.length).toBe(input.samples);
        for (let i = 0; i < expected.length; i += 1) {
            expect(noise[i]).toBeCloseTo(expected[i], 10);
            expect(Number((final?.["releases"] as number[])[i])).toBeCloseTo(input.trueValue + expected[i], 10);
        }
    });

    it("keeps neighboring-dataset likelihood ratios within exp(epsilon)", () => {
        const sensitivity = 4;
        const epsilon = 0.75;
        const scale = sensitivity / epsilon;
        const v1 = 20;
        const v2 = v1 + sensitivity;
        let maxRatio = 0;
        for (let x = -100; x <= 150; x += 0.5) {
            const density1 = Math.exp(-Math.abs(x - v1) / scale) / (2 * scale);
            const density2 = Math.exp(-Math.abs(x - v2) / scale) / (2 * scale);
            maxRatio = Math.max(maxRatio, density1 / density2);
        }
        expect(maxRatio).toBeLessThanOrEqual(Math.exp(epsilon) + 1e-9);

        const frames = [...mod.run({ trueValue: v1, sensitivity, epsilon, samples: 1 })];
        expect(Number(frames[0]?.meta["scale"])).toBeCloseTo(scale, 10);
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
