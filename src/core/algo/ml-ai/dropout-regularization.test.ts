/**
 * dropout-regularization.test.ts - Scaling/expectation property, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dropout-regularization";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], width: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(width);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["mask"]).toBe("object");
        expect(typeof frame.meta["expectation"]).toBe("object");
    });
}

describe("DropoutRegularization", () => {
    it("applies the exact inverted scaling to every unit", () => {
        const input = mod.defaultInput as {
            activations: number[];
            rate: number;
            seed: number;
            trials: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.activations.length);
        const scale = 1 / (1 - input.rate);
        for (const frame of frames.slice(1, -1)) {
            const mask = frame.meta["mask"] as number[];
            frame.entities.forEach((entity, index) => {
                const expected = input.activations[index]! * mask[index]!;
                expect(Number(entity.value)).toBeCloseTo(expected, 5);
                if (mask[index] === 0) {
                    expect(Number(entity.value)).toBe(0);
                } else {
                    expect(mask[index]).toBeCloseTo(scale, 5);
                }
            });
        }
    });

    it("recovers the original activations in expectation over many trials", () => {
        const activations = [1, 2, 3, 4];
        const rate = 0.5;
        const frames = [...mod.run({ activations, rate, seed: 3, trials: 600 })];
        checkFrames(frames, activations.length);
        const mean = frames[frames.length - 1]?.meta["expectation"] as number[];
        for (let i = 0; i < activations.length; i += 1) {
            expect(Math.abs(mean[i]! - activations[i]!)).toBeLessThan(0.35);
        }
    });

    it("keeps every unit when the drop rate is zero", () => {
        const frames = [...mod.run({ activations: [1, 2, 3], rate: 0, seed: 5, trials: 3 })];
        checkFrames(frames, 3);
        for (const frame of frames.slice(1, -1)) {
            const mask = frame.meta["mask"] as number[];
            expect(mask).toEqual([1, 1, 1]);
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
