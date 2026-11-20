/** savitzky-golay-filter.test.ts - Polynomial reproduction moment checks. */

import { describe, expect, it } from "vitest";
import mod from "./savitzky-golay-filter";
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

describe("Savitzky-Golay Filter", () => {
    it("reproduces every polynomial up to the fit order exactly", () => {
        for (const input of [{ window: 7, order: 3 }, { window: 9, order: 4 }, { window: 5, order: 2 }]) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const coefficients = final["coefficients"] as number[];
            const center = Number(final["center"]);
            expect(coefficients.length).toBe(input.window);
            for (let t = 0; t <= input.order; t += 1) {
                const moment = coefficients.reduce((sum, c, i) => sum + c * (i - center) ** t, 0);
                expect(moment).toBeCloseTo(t === 0 ? 1 : 0, 8);
            }
            expect(coefficients.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        }
    });

    it("has symmetric coefficients and reproduces a quadratic signal", () => {
        const input = { window: 7, order: 3 };
        const frames = [...mod.run(input)];
        const coefficients = frames[frames.length - 1]!.meta["coefficients"] as number[];
        for (let i = 0; i < coefficients.length; i += 1) {
            expect(coefficients[i]).toBeCloseTo(coefficients[coefficients.length - 1 - i]!, 10);
        }
        const signal = coefficients.map((_, i) => (i - 3) ** 2 + 2 * (i - 3) + 5);
        const smoothed = signal.reduce((sum, y, i) => sum + y * coefficients[i]!, 0);
        expect(smoothed).toBeCloseTo(5, 8);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
