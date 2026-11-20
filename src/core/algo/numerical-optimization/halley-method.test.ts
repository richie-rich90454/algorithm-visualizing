/** halley-method.test.ts - Exact roots, independent bisection reference, zero-denominator guard, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { halley } from "./halley-method";
import type { VisualFrame } from "@/types";

function bisect(f: (x: number) => number, lo: number, hi: number): number {
    let a = lo;
    let b = hi;
    for (let i = 0; i < 200; i += 1) {
        const mid = (a + b) / 2;
        if (f(a) * f(mid) <= 0) { b = mid; } else { a = mid; }
    }
    return (a + b) / 2;
}

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

describe("Halley's method", () => {
    it("converges to the cube root of two quickly", () => {
        const result = halley((x) => x * x * x - 2, (x) => 3 * x * x, (x) => 6 * x, 1.5, 20, 1e-12);
        expect(result.converged).toBe(true);
        expect(result.trace.length).toBeLessThan(10);
        expect(result.root).toBeCloseTo(Math.cbrt(2), 10);
        expect(Math.abs(result.values[result.values.length - 1] ?? 1)).toBeLessThan(1e-12);
    });

    it("matches independent bisection and exact roots from several starts", () => {
        for (const start of [0.5, 1, 2, 5]) {
            const cube = halley((x) => x * x * x - 2, (x) => 3 * x * x, (x) => 6 * x, start, 30, 1e-12);
            expect(cube.root).toBeCloseTo(bisect((x) => x * x * x - 2, 0, 3), 9);
            const square = halley((x) => x * x - 2, (x) => 2 * x, () => 2, start, 30, 1e-12);
            expect(square.root).toBeCloseTo(Math.sqrt(2), 10);
        }
    });

    it("stops cleanly when the denominator is zero", () => {
        const result = halley((x) => x * x * x - 2, (x) => 3 * x * x, (x) => 6 * x, 0, 20, 1e-12);
        expect(result.converged).toBe(false);
        expect(result.trace.length).toBe(1);
        expect(result.root).toBe(0);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["converged"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
