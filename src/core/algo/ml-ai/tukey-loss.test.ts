/** tukey-loss.test.ts - Biweight definition, cap, redescending weight, and frame checks. */

import { describe, expect, it } from "vitest";
import mod, { tukeyFor } from "./tukey-loss";
import type { VisualFrame } from "@/types";

interface Input {
    predictions: number[];
    targets: number[];
    cutoff: number;
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Tukey Biweight Loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force evaluation of the biweight definition", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.predictions.length);
        const got = frames[frames.length - 1]?.meta["losses"] as number[];
        const c = input.cutoff;
        input.predictions.forEach((prediction, i) => {
            const r = prediction - (input.targets[i] ?? 0);
            const u = r / c;
            const expected = Math.abs(u) <= 1
                ? (c * c / 6) * (1 - Math.pow(1 - u * u, 3))
                : c * c / 6;
            expect(got[i]).toBeCloseTo(expected, 12);
        });
    });

    it("is zero at zero, bounded by the cap, and even", () => {
        const c = 2;
        const cap = c * c / 6;
        expect(tukeyFor(0, c).loss).toBeCloseTo(0, 12);
        for (const r of [-3, -1, -0.4, 0.4, 1, 3]) {
            const result = tukeyFor(r, c);
            expect(result.loss).toBeLessThanOrEqual(cap + 1e-12);
            expect(result.loss).toBeCloseTo(tukeyFor(-r, c).loss, 12);
        }
    });

    it("assigns zero weight past the cutoff and is continuous there", () => {
        expect(tukeyFor(2.5, 2).weight).toBe(0);
        expect(tukeyFor(2.5, 2).rejected).toBe(true);
        expect(tukeyFor(1.9, 2).weight).toBeGreaterThan(0);
        expect(tukeyFor(2, 2).loss).toBeCloseTo(tukeyFor(2 - 1e-9, 2).loss, 6);
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
