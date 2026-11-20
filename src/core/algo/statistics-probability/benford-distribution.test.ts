/** benford-distribution.test.ts - Law normalization and monotonicity checks. */

import { describe, expect, it } from "vitest";
import mod from "./benford-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    });
}

describe("Benford's Law", () => {
    it("matches the closed-form law and sums to one", () => {
        const frames = [...mod.run({ digits: 9 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const probabilities = final["probabilities"] as number[];
        for (let d = 1; d <= 9; d += 1) {
            expect(probabilities[d - 1]!).toBeCloseTo(Math.log10(1 + 1 / d), 12);
        }
        expect(Number(final["total"])).toBeCloseTo(1, 12);
        expect(Number(final["twoDigitTotal"])).toBeCloseTo(1, 12);
        expect(probabilities[0]!).toBeCloseTo(Math.log10(2), 12);
    });

    it("is strictly decreasing in the leading digit", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const probabilities = frames[frames.length - 1]!.meta["probabilities"] as number[];
        for (let i = 1; i < probabilities.length; i += 1) {
            expect(probabilities[i]!).toBeLessThan(probabilities[i - 1]!);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
