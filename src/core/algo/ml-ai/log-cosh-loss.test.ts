/** log-cosh-loss.test.ts - Definition, symmetry, and asymptotic checks with frame checks. */

import { describe, expect, it } from "vitest";
import mod, { logCoshFor } from "./log-cosh-loss";
import type { VisualFrame } from "@/types";

interface Input {
    predictions: number[];
    targets: number[];
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

describe("Log-Cosh Loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a direct log(cosh) evaluation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.predictions.length);
        const got = frames[frames.length - 1]?.meta["losses"] as number[];
        input.predictions.forEach((prediction, i) => {
            const r = prediction - (input.targets[i] ?? 0);
            expect(got[i]).toBeCloseTo(Math.log(Math.cosh(r)), 12);
        });
    });

    it("is even, nonnegative, and zero at zero", () => {
        expect(logCoshFor(0).loss).toBeCloseTo(0, 12);
        for (const r of [-5, -1, -0.3, 0.3, 1, 5]) {
            expect(logCoshFor(r).loss).toBeCloseTo(logCoshFor(-r).loss, 12);
            expect(logCoshFor(r).loss).toBeGreaterThanOrEqual(0);
        }
    });

    it("is quadratic near zero and linear far away", () => {
        expect(logCoshFor(0.01).loss).toBeCloseTo(0.5 * 0.01 * 0.01, 8);
        expect(logCoshFor(10).loss).toBeCloseTo(Math.log(Math.cosh(10)), 12);
        expect(logCoshFor(10).loss).toBeCloseTo(10 - Math.LN2, 6);
        expect(logCoshFor(-10).loss).toBeCloseTo(Math.log(Math.cosh(10)), 12);
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
