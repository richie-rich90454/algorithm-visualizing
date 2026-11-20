/**
 * expectile.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./expectile";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Brute-force minimizer of the asymmetric squared-error objective on a fine grid. */
function bruteForceExpectile(values: number[], tau: number): number {
    const lo = Math.min(...values) - 1;
    const hi = Math.max(...values) + 1;
    const steps = 200000;
    let bestPoint = lo;
    let bestLoss = Infinity;
    for (let i = 0; i <= steps; i += 1) {
        const point = lo + ((hi - lo) * i) / steps;
        let loss = 0;
        for (const value of values) {
            const diff = value - point;
            loss += diff >= 0 ? tau * diff * diff : (1 - tau) * diff * diff;
        }
        if (loss < bestLoss) {
            bestLoss = loss;
            bestPoint = point;
        }
    }
    return bestPoint;
}

describe("Expectile", () => {
    it("matches a brute-force minimizer of the asymmetric loss", () => {
        const cases = [
            { values: [1, 2, 3, 4, 10], tau: 0.8 },
            { values: [-5, -1, 0, 2, 3], tau: 0.3 },
            { values: [2, 4, 4, 4, 9, 9], tau: 0.6 },
        ];
        for (const { values, tau } of cases) {
            const frames = [...mod.run({ values, tau })];
            checkFrames(frames, values.length);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["expectile"])).toBeCloseTo(bruteForceExpectile(values, tau), 3);
        }
    });

    it("reduces to the sample mean at tau = 0.5", () => {
        const values = [1, 2, 8, 20];
        const frames = [...mod.run({ values, tau: 0.5 })];
        const final = frames[frames.length - 1]?.meta;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        expect(Number(final?.["expectile"])).toBeCloseTo(mean, 8);
    });

    it("balances weighted excess and deficit at the answer and terminates", () => {
        const values = [1, 2, 3, 4, 10];
        const tau = 0.8;
        const frames = [...mod.run({ values, tau })];
        const e = Number(frames[frames.length - 1]?.meta["expectile"]);
        let excess = 0;
        let deficit = 0;
        for (const value of values) {
            if (value > e) {
                excess += value - e;
            } else {
                deficit += e - value;
            }
        }
        expect(tau * excess).toBeCloseTo((1 - tau) * deficit, 3);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
