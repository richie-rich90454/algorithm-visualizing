/**
 * gauss-newton.test.ts - Brute-force grid search cross-check of the fitted
 * minimum, plus monotone-convergence, frame-shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./gauss-newton";
import type { VisualFrame } from "@/types";

const DATA = [0, 1, 2, 3, 4].map((x) => ({ x, y: 2 * Math.exp(0.5 * x) }));

function ssr(points: typeof DATA, a: number, b: number): number {
    let sum = 0;
    for (const p of points) {
        const r = a * Math.exp(b * p.x) - p.y;
        sum += r * r;
    }
    return sum;
}

/** Brute-force the global minimum on a fine parameter grid. */
function bruteForceMinimum(points: typeof DATA): number {
    let best = Number.POSITIVE_INFINITY;
    for (let ai = 0; ai <= 200; ai += 1) {
        const a = ai * 0.02;
        for (let bi = 0; bi <= 100; bi += 1) {
            const b = bi * 0.015;
            best = Math.min(best, ssr(points, a, b));
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(pointCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Gauss-Newton Least Squares", () => {
    it("reaches the brute-force minimum on the default exponential data", () => {
        const input = { ...(mod.defaultInput as object), points: DATA };
        const frames = [...mod.run(input)];
        checkFrames(frames, DATA.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        const bruteMin = bruteForceMinimum(DATA);
        expect(finalMeta["ssr"] as number).toBeLessThanOrEqual(bruteMin + 1e-3);
        expect(Math.abs((finalMeta["a"] as number) - 2)).toBeLessThan(0.02);
        expect(Math.abs((finalMeta["b"] as number) - 0.5)).toBeLessThan(0.02);
    });

    it("never increases the residual sum during iterations", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const sums = frames.map((f) => f.meta["ssr"] as number);
        for (let i = 1; i < sums.length; i += 1) {
            expect(sums[i]!).toBeLessThanOrEqual(sums[i - 1]! + 1e-12);
        }
    });

    it("fits noisy data better than the starting point", () => {
        const points = [
            { x: 0, y: 2.1 },
            { x: 1, y: 3.2 },
            { x: 2, y: 5.6 },
            { x: 3, y: 8.8 },
            { x: 4, y: 15.2 },
        ];
        const frames = [...mod.run({ points, a0: 1, b0: 0, iterations: 20 })];
        checkFrames(frames, points.length);
        expect((frames[frames.length - 1]?.meta["ssr"] as number)).toBeLessThan(
            (frames[0]?.meta["ssr"] as number),
        );
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
