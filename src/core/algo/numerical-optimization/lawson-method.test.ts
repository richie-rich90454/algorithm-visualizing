/**
 * lawson-method.test.ts - Integrating-factor accuracy and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { lawsonReference, lawsonStep } from "./lawson-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Lawson Method", () => {
    it("reduces to the exact linear exponential when forcing is zero", () => {
        const step = lawsonStep(1, -2, 0.1, 0, "quadratic");
        expect(step).toBeCloseTo(Math.exp(-0.2), 12);
        let y = 2;
        for (let k = 0; k < 10; k += 1) {
            y = lawsonStep(y, 0.7, 0.02, 0, "cubic");
        }
        expect(y).toBeCloseTo(2 * Math.exp(0.7 * 0.2), 12);
    });

    it("matches a fine reference at fourth-order accuracy", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["accurate"]).toBe(true);
        const coarse = Number(final?.["finalError"]);
        const fineFrames = [...mod.run({ ...(mod.defaultInput as Record<string, unknown>), h: 0.025, steps: 48 })];
        expect(Number(fineFrames[fineFrames.length - 1]?.meta["finalError"])).toBeLessThan(coarse);
        expect(lawsonReference(-1.5, 0.05, 2, 1, 1, "cubic")).toHaveLength(3);
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
