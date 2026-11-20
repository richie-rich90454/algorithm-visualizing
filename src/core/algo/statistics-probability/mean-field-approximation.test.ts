/**
 * mean-field-approximation.test.ts - Fixed-point and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod, { meanFieldSolve } from "./mean-field-approximation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Root of g(m) = m - tanh(beta(z J m + h)) on a bracket, found independently. */
function bisectRoot(g: (m: number) => number, lo: number, hi: number): number {
    let a = lo;
    let b = hi;
    for (let i = 0; i < 200; i += 1) {
        const mid = (a + b) / 2;
        if (g(a) * g(mid) <= 0) {
            b = mid;
        } else {
            a = mid;
        }
    }
    return (a + b) / 2;
}

describe("Mean-field approximation", () => {
    it("converges to a genuine fixed point", () => {
        for (const beta of [0.1, 0.2, 0.5, 1.0]) {
            const result = meanFieldSolve(beta, 4, 1, 0, 0.2, 1e-10, 500);
            const recomputed = Math.tanh(beta * (4 * result.magnetization));
            expect(result.magnetization).toBeCloseTo(recomputed, 9);
            expect(result.residual).toBeLessThan(1e-8);
            expect(result.trajectory.length).toBeGreaterThan(0);
            for (const m of result.trajectory) {
                expect(Math.abs(m)).toBeLessThan(1);
            }
        }
    });

    it("shows spontaneous magnetization only below the critical temperature", () => {
        expect(meanFieldSolve(0.1, 4, 1, 0, 0.2, 1e-10, 500).magnetization).toBeCloseTo(0, 6);
        const ordered = meanFieldSolve(0.5, 4, 1, 0, 0.2, 1e-10, 500);
        expect(Math.abs(ordered.magnetization)).toBeGreaterThan(0.5);

        const g = (m: number) => m - Math.tanh(0.5 * 4 * m);
        expect(bisectRoot(g, 0.05, 0.99)).toBeCloseTo(ordered.magnetization, 8);
    });

    it("handles an external field and negative initial guesses", () => {
        const positive = meanFieldSolve(0.2, 4, 1, 0.3, 0.1, 1e-10, 500);
        const negative = meanFieldSolve(0.2, 4, 1, -0.3, -0.1, 1e-10, 500);
        expect(positive.magnetization).toBeGreaterThan(0);
        expect(negative.magnetization).toBeLessThan(0);
        expect(positive.magnetization).toBeCloseTo(-negative.magnetization, 8);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta as {
            m: number;
            residual: number;
            betaC: number;
            done: boolean;
        };
        expect(final.done).toBe(true);
        expect(final.betaC).toBeCloseTo(0.25, 9);
        expect(final.residual).toBeLessThan(1e-8);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
