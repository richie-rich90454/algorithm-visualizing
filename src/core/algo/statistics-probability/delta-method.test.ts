/**
 * delta-method.test.ts - Independent variance propagation and interval checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./delta-method";
import type { VisualFrame } from "@/types";

type Transform = "square" | "log" | "exp" | "sqrt";

/** Independent exact derivatives of the four transforms. */
function derivative(transform: Transform, x: number): number {
    switch (transform) {
        case "square":
            return 2 * x;
        case "log":
            return 1 / x;
        case "exp":
            return Math.exp(x);
        case "sqrt":
            return 1 / (2 * Math.sqrt(x));
    }
}

/** Check frame shape and termination. */
function checkFrames(frames: VisualFrame[], bars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(bars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Delta Method", () => {
    it("uses the correct derivative for every transform (independent reference)", () => {
        const transforms: Transform[] = ["square", "log", "exp", "sqrt"];
        for (const transform of transforms) {
            const mu = transform === "log" || transform === "sqrt" ? 3 : 1.5;
            const frames = [...mod.run({ mu, sigma: 1, n: 10, xbar: mu, transform, z: 1.96 })];
            checkFrames(frames, 5);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["derivative"])).toBeCloseTo(derivative(transform, mu), 6);
        }
    });

    it("propagates variance and builds the interval for a square transform", () => {
        const frames = [...mod.run({ mu: 3, sigma: 2, n: 16, xbar: 3.1, transform: "square", z: 1.96 })];
        checkFrames(frames, 5);
        const final = frames[frames.length - 1]?.meta;
        const d = derivative("square", 3);
        const expectedVariance = (d * d * 2 * 2) / 16;
        const expectedSe = Math.sqrt(expectedVariance);
        const gBar = 3.1 * 3.1;
        expect(Number(final?.["derivative"])).toBeCloseTo(6, 9);
        expect(Number(final?.["variance"])).toBeCloseTo(expectedVariance, 9);
        expect(Number(final?.["se"])).toBeCloseTo(expectedSe, 9);
        expect(Number(final?.["lower"])).toBeCloseTo(gBar - 1.96 * expectedSe, 9);
        expect(Number(final?.["upper"])).toBeCloseTo(gBar + 1.96 * expectedSe, 9);
        expect(Number(final?.["variance"])).toBeCloseTo(9, 9);
    });

    it("gives zero uncertainty when sigma is zero", () => {
        const frames = [...mod.run({ mu: 2, sigma: 0, n: 100, xbar: 2, transform: "log", z: 1.96 })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["variance"])).toBe(0);
        expect(Number(final?.["se"])).toBe(0);
        expect(Number(final?.["lower"])).toBeCloseTo(Math.log(2), 9);
        expect(Number(final?.["upper"])).toBeCloseTo(Math.log(2), 9);
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
