/** swish-activation.test.ts - Sigmoid-gate definition, derivative, minimum, and frames. */

import { describe, expect, it } from "vitest";
import mod, { swishFor } from "./swish-activation";
import type { VisualFrame } from "@/types";

interface Input {
    values: number[];
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

describe("Swish Activation", () => {
    const input = mod.defaultInput as Input;

    it("matches a direct sigmoid-gate evaluation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const got = frames[frames.length - 1]?.meta["values"] as number[];
        input.values.forEach((x, i) => {
            const sigmoid = 1 / (1 + Math.exp(-x));
            expect(got[i]).toBeCloseTo(x * sigmoid, 12);
            expect(swishFor(x).sigmoid).toBeCloseTo(sigmoid, 12);
        });
    });

    it("has a derivative consistent with finite differences", () => {
        const h = 1e-5;
        for (const x of [-3, -1, 0, 0.5, 2]) {
            const finiteDifference = (swishFor(x + h).value - swishFor(x - h).value) / (2 * h);
            expect(swishFor(x).derivative).toBeCloseTo(finiteDifference, 4);
        }
    });

    it("passes through zero, approaches the identity, and has the expected minimum", () => {
        expect(swishFor(0).value).toBeCloseTo(0, 12);
        expect(swishFor(10).value).toBeGreaterThan(9.99);
        expect(swishFor(10).value).toBeLessThanOrEqual(10);
        expect(swishFor(-20).value).toBeCloseTo(0, 6);
        let bestX = 0;
        let bestValue = Infinity;
        for (let x = -3; x <= 1; x += 0.001) {
            const value = swishFor(x).value;
            if (value < bestValue) {
                bestValue = value;
                bestX = x;
            }
        }
        expect(bestX).toBeCloseTo(-1.278, 2);
        expect(bestValue).toBeCloseTo(-0.278, 2);
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
