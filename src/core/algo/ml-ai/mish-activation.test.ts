/**
 * mish-activation.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { mishFor } from "./mish-activation";
import type { VisualFrame } from "@/types";

function directMish(x: number): number {
    return x * Math.tanh(Math.log(1 + Math.exp(x)));
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Mish Activation", () => {
    it("matches the direct definition across a range", () => {
        const values = [-6, -3, -1, -0.2, 0, 0.2, 1, 3, 6];
        const frames = [...mod.run({ values })];
        checkFrames(frames, values.length, 5);
        const got = frames[frames.length - 1]!.meta["values"] as number[];
        got.forEach((v, i) => expect(v).toBeCloseTo(directMish(values[i]!), 8));
    });

    it("analytic derivative matches a finite difference", () => {
        for (let k = -8; k <= 8; k += 1) {
            const x = k / 3;
            const eps = 1e-6;
            const numeric = (directMish(x + eps) - directMish(x - eps)) / (2 * eps);
            expect(mishFor(x).derivative).toBeCloseTo(numeric, 5);
        }
    });

    it("has the expected landmarks", () => {
        expect(mishFor(0).value).toBeCloseTo(0, 12);
        expect(mishFor(5).value).toBeGreaterThan(4.9);
        expect(mishFor(-5).value).toBeCloseTo(0, 1);
        expect(mishFor(-5).value).toBeLessThan(0);
        expect(mishFor(0).softplus).toBeCloseTo(Math.LN2, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
