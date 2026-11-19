/** implicit-euler.test.ts - Closed-form amplification factor, stiff stability, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { implicitEuler } from "./implicit-euler";
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

describe("Implicit Euler", () => {
    it("matches the closed-form factor for linear decay", () => {
        for (const lambda of [-10, -2, -0.5]) {
            for (const h of [0.01, 0.05, 0.2]) {
                const steps = 20;
                const factor = 1 / (1 - lambda * h);
                const result = implicitEuler((_t, y) => lambda * y, 1, h, steps, 1e-14);
                for (let i = 0; i <= steps; i += 1) {
                    expect(result.y[i] ?? 0).toBeCloseTo(factor ** i, 9);
                    expect(result.t[i]).toBeCloseTo(i * h, 12);
                }
            }
        }
    });

    it("stays bounded on a stiff equation with a large step", () => {
        const result = implicitEuler((_t, y) => -1000 * y, 1, 0.5, 30, 1e-14);
        for (const value of result.y) {
            expect(Number.isFinite(value)).toBe(true);
            expect(Math.abs(value)).toBeLessThanOrEqual(1);
        }
        expect(result.y[result.y.length - 1] ?? 0).toBeGreaterThan(0);
    });

    it("reproduces the exact solution for y' = 1", () => {
        const result = implicitEuler(() => 1, 0, 0.1, 10, 1e-14);
        expect(result.y[10] ?? 0).toBeCloseTo(1, 10);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const factor = 1 / (1 - (-10) * 0.05);
        expect(final?.["y"]).toBeCloseTo(factor ** 20, 9);
        expect(generator.next().done).toBe(true);
    });
});
