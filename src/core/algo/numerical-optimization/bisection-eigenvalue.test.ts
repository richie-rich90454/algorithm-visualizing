/**
 * bisection-eigenvalue.test.ts - Closed-form check, Sturm count property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bisection-eigenvalue";
import type { VisualFrame } from "@/types";

/** Independent closed-form eigenvalues of the n by n Laplacian. */
function analyticEigenvalues(n: number): number[] {
    return Array.from({ length: n }, (_, j) => 2 - 2 * Math.cos((Math.PI * (j + 1)) / (n + 1)));
}

/** Independent dense Sturm count by counting negative eigenvalues of a shifted matrix. */
function bruteCount(n: number, x: number): number {
    const m: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 2 - x : Math.abs(i - j) === 1 ? -1 : 0)),
    );
    let count = 0;
    for (let k = 0; k < n; k += 1) {
        let pivot = m[k]![k]!;
        if (pivot < 0) count += 1;
        for (let i = k + 1; i < n; i += 1) {
            const factor = m[i]![k]! / pivot;
            for (let j = k; j < n; j += 1) m[i]![j] = m[i]![j]! - factor * m[k]![j]!;
        }
    }
    return count;
}

function checkFrames(frames: VisualFrame[], iterations: number): void {
    expect(frames.length).toBe(iterations + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["cols"]).toBe(6);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        frame.entities.forEach((e) => {
            expect(Number.isFinite(e.value as number)).toBe(true);
        });
    });
}

describe("BisectionEigenvalue", () => {
    it("converges to the closed-form smallest eigenvalue", () => {
        for (const n of [3, 5, 8, 12]) {
            const frames = [...mod.run({ n, iterations: 45 })];
            checkFrames(frames, 45);
            const final = frames[frames.length - 1]?.meta;
            const expected = Math.min(...analyticEigenvalues(n));
            expect(final?.["exact"]).toBeCloseTo(expected, 12);
            expect(final?.["estimate"] as number).toBeCloseTo(expected, 8);
            expect(final?.["error"] as number).toBeLessThan(1e-6);
        }
    });

    it("keeps a valid bracket whose Sturm count separates the smallest eigenvalue", () => {
        const n = 6;
        const frames = [...mod.run({ n, iterations: 40 })];
        const eigenvalues = analyticEigenvalues(n);
        for (const frame of frames) {
            const lo = frame.meta["lower"] as number;
            const hi = frame.meta["upper"] as number;
            expect(hi).toBeGreaterThanOrEqual(lo);
            expect(bruteCount(n, lo)).toBe(0);
            expect(bruteCount(n, hi)).toBeGreaterThanOrEqual(1);
            // Each displayed midpoint count matches an independent dense count.
            if (typeof frame.meta["mid"] === "number") {
                const mid = frame.meta["mid"] as number;
                const shown = frame.meta["count"] as number;
                expect(shown).toBe(eigenvalues.filter((v) => v < mid).length);
            }
        }
    });

    it("tightens the bracket monotonically", () => {
        const frames = [...mod.run({ n: 7, iterations: 30 })];
        let previousWidth = 4;
        for (const frame of frames) {
            const width = (frame.meta["upper"] as number) - (frame.meta["lower"] as number);
            expect(width).toBeLessThanOrEqual(previousWidth + 1e-12);
            previousWidth = width;
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(32);
        expect(generator.next().done).toBe(true);
    });
});
