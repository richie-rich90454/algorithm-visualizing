/**
 * trapezoidal-rule.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./trapezoidal-rule";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe((n + 1) * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

describe("Trapezoidal rule", () => {
    it("is exact for a linear function", () => {
        const frames = [...mod.run({ a: 0, b: 3, n: 5, fn: "linear" })];
        checkFrames(frames, 5);
        const metaFrame = finalMeta(frames);
        // Integral of 2x + 1 from 0 to 3 is 3^2 + 3 = 12.
        expect(metaFrame["approximation"]).toBeCloseTo(12, 9);
        expect(metaFrame["exact"]).toBeCloseTo(12, 9);
        expect(metaFrame["error"]).toBeCloseTo(0, 9);
    });

    it("agrees with a brute-force trapezoid sum for x squared", () => {
        const a = 0;
        const b = 1;
        const n = 8;
        const frames = [...mod.run({ a, b, n, fn: "x2" })];
        checkFrames(frames, n);
        const h = (b - a) / n;
        let brute = 0;
        for (let i = 0; i <= n; i += 1) {
            const weight = i === 0 || i === n ? 0.5 : 1;
            brute += weight * (a + i * h) ** 2;
        }
        brute *= h;
        const metaFrame = finalMeta(frames);
        expect(metaFrame["approximation"]).toBeCloseTo(brute, 9);
        expect(metaFrame["approximation"]).toBeCloseTo(1 / 3, 2);
    });

    it("improves as n grows and terminates cleanly", () => {
        const coarse = finalMeta([...mod.run({ a: 0, b: 1, n: 2, fn: "x2" })])["error"] as number;
        const fine = finalMeta([...mod.run({ a: 0, b: 1, n: 32, fn: "x2" })])["error"] as number;
        expect(fine).toBeLessThan(coarse);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
