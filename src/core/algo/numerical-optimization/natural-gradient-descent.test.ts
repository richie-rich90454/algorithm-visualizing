/** natural-gradient-descent.test.ts - Normal-equation cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./natural-gradient-descent";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent solve of the 2 by 2 normal equations. */
function leastSquares(x: number[][], y: number[]): [number, number] {
    let a = 0, b = 0, c = 0, d = 0, p = 0, q = 0;
    for (let i = 0; i < x.length; i += 1) {
        const u = x[i]?.[0] ?? 0;
        const v = x[i]?.[1] ?? 0;
        const r = y[i] ?? 0;
        a += u * u; b += u * v; c += v * v; p += u * r; q += v * r;
    }
    const det = a * c - b * b;
    return [(c * p - b * q) / det, (a * q - b * p) / det];
}

describe("Natural Gradient Descent", () => {
    it("reaches the least-squares answer in one full step", () => {
        const input = mod.defaultInput as { x: number[][]; y: number[]; theta: number[]; sigma: number };
        const frames = [...mod.run({ ...input, iterations: 1 })];
        checkFrames(frames);
        const theta = frames[frames.length - 1]?.meta["theta"] as number[];
        const expected = leastSquares(input.x, input.y);
        expect(theta[0] ?? 0).toBeCloseTo(expected[0] ?? 0, 9);
        expect(theta[1] ?? 0).toBeCloseTo(expected[1] ?? 0, 9);
    });

    it("beats a coarse brute-force grid and lowers the loss", () => {
        const input = mod.defaultInput as { x: number[][]; y: number[]; theta: number[]; sigma: number };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        let gridBest = Infinity;
        for (let i = -100; i <= 100; i += 1) {
            for (let j = -100; j <= 100; j += 1) {
                const t0 = i / 20;
                const t1 = j / 20;
                let total = 0;
                for (let k = 0; k < input.x.length; k += 1) {
                    const row = input.x[k] ?? [0, 0];
                    const residual = (row[0] ?? 0) * t0 + (row[1] ?? 0) * t1 - (input.y[k] ?? 0);
                    total += residual * residual / (2 * input.sigma * input.sigma);
                }
                gridBest = Math.min(gridBest, total);
            }
        }
        const finalLoss = Number(frames[frames.length - 1]?.meta["loss"]);
        expect(finalLoss).toBeLessThanOrEqual(gridBest + 1e-6);
        expect(finalLoss).toBeLessThan(Number(frames[0]?.meta["loss"]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
