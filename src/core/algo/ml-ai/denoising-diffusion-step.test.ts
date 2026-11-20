/**
 * denoising-diffusion-step.test.ts - Forward/reverse algebra check, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./denoising-diffusion-step";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], width: number): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(width);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["maxError"]).toBe("number");
    });
}

describe("DenoisingDiffusionStep", () => {
    it("inverts the forward step exactly for the default input", () => {
        const input = mod.defaultInput as { signal: number[]; alpha: number; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.signal.length);
        const noise = frames[1]?.meta["noise"] as number[];
        const noisy = frames[2]?.meta["noisy"] as number[];
        const sqrtAlpha = Math.sqrt(input.alpha);
        const sqrtNoise = Math.sqrt(1 - input.alpha);
        for (let i = 0; i < input.signal.length; i += 1) {
            expect(noisy[i]!).toBeCloseTo(sqrtAlpha * input.signal[i]! + sqrtNoise * noise[i]!, 5);
        }
        const reconstructed = frames[3]?.meta["reconstructed"] as number[];
        for (let i = 0; i < input.signal.length; i += 1) {
            expect(reconstructed[i]!).toBeCloseTo(input.signal[i]!, 5);
        }
        expect(Number(frames[frames.length - 1]?.meta["maxError"])).toBeLessThan(1e-9);
        expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
    });

    it("is exact across several alphas and seeds", () => {
        const signal = [5, -3, 0, 1.5];
        for (const alpha of [0.2, 0.5, 0.9]) {
            for (const seed of [1, 23, 100]) {
                const frames = [...mod.run({ signal, alpha, seed })];
                checkFrames(frames, signal.length);
                expect(Number(frames[frames.length - 1]?.meta["maxError"])).toBeLessThan(1e-9);
            }
        }
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
