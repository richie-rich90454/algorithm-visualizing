/**
 * steffensen-method.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./steffensen-method";
import type { VisualFrame } from "@/types";

const f = (x: number): number => x * x - 2;

/** Independent Steffensen replay. */
function reference(x0: number, iterations: number): number {
    let x = x0;
    for (let i = 0; i < iterations; i += 1) {
        const fx = f(x);
        const denominator = f(x + fx) - fx;
        if (Math.abs(denominator) < 1e-15) break;
        x = x - (fx * fx) / denominator;
        if (Math.abs(f(x)) < 1e-13) break;
    }
    return x;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThanOrEqual(1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Steffensen's Method", () => {
    it("converges to the square root of two", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const root = Number(final?.["root"]);
        expect(root).toBeCloseTo(Math.SQRT2, 9);
        expect(Math.abs(f(root))).toBeLessThan(1e-9);
    });

    it("matches an independent replay from several starts", () => {
        for (const x0 of [0.5, 1, 1.5, 3]) {
            const frames = [...mod.run({ x0, iterations: 12 })];
            const root = Number(frames[frames.length - 1]?.meta["root"]);
            expect(Math.abs(root - reference(x0, 12))).toBeLessThan(1e-9);
        }
    });

    it("reaches a residual far smaller than the initial one", () => {
        const frames = [...mod.run({ x0: 3, iterations: 12 })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["residual"])).toBeLessThan(Math.abs(f(3)) / 1e6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
