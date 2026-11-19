/** crank-nicolson.test.ts - Amplification factor, second-order check, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { crankNicolson } from "./crank-nicolson";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Crank-Nicolson", () => {
    it("matches the closed-form trapezoidal factor", () => {
        for (const lambda of [-10, -2, -0.5]) {
            for (const h of [0.01, 0.05, 0.2]) {
                const steps = 20;
                const factor = (1 + (lambda * h) / 2) / (1 - (lambda * h) / 2);
                const result = crankNicolson((_t, y) => lambda * y, 1, h, steps, 1e-14);
                for (let i = 0; i <= steps; i += 1) {
                    expect(result.y[i] ?? 0).toBeCloseTo(factor ** i, 9);
                }
            }
        }
    });

    it("is second order and more accurate than implicit Euler", () => {
        const lambda = -2;
        const coarse = crankNicolson((_t, y) => lambda * y, 1, 0.1, 10, 1e-14);
        const fine = crankNicolson((_t, y) => lambda * y, 1, 0.05, 20, 1e-14);
        const exact = Math.exp(lambda);
        const coarseError = Math.abs((coarse.y[coarse.y.length - 1] ?? 0) - exact);
        const fineError = Math.abs((fine.y[fine.y.length - 1] ?? 0) - exact);
        expect(coarseError).toBeLessThan(1e-3);
        expect(fineError).toBeLessThan(coarseError / 3);
    });

    it("stays bounded for a stiff decay", () => {
        const result = crankNicolson((_t, y) => -1000 * y, 1, 0.5, 20, 1e-14);
        for (const value of result.y) {
            expect(Number.isFinite(value)).toBe(true);
            expect(Math.abs(value)).toBeLessThanOrEqual(1);
        }
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["y"]).toBeCloseTo(final?.["exact"] as number, 4);
        expect(generator.next().done).toBe(true);
    });
});
