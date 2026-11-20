/**
 * newton-method-multivariate.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./newton-method-multivariate";
import type { VisualFrame } from "@/types";

type Coeffs = number[][];

function evaluate(coefficients: Coeffs, x: number, y: number): [number, number] {
    const value = (row: number[]) =>
        (row[0] ?? 0) * x * x + (row[1] ?? 0) * y * y + (row[2] ?? 0) * x + (row[3] ?? 0) * y + (row[4] ?? 0);
    return [value(coefficients[0] ?? []), value(coefficients[1] ?? [])];
}

/** Independent coarse-to-fine grid search for a root of the system. */
function gridRoot(coefficients: Coeffs): [number, number] {
    let best: [number, number] = [0, 0];
    let bestValue = Infinity;
    let radius = 6;
    let bestX = 0;
    let bestY = 0;
    for (let pass = 0; pass < 8; pass += 1) {
        bestValue = Infinity;
        const divisions = 60;
        for (let i = 0; i <= divisions; i += 1) {
            for (let j = 0; j <= divisions; j += 1) {
                const x = bestX - radius + (2 * radius * i) / divisions;
                const y = bestY - radius + (2 * radius * j) / divisions;
                const [f1, f2] = evaluate(coefficients, x, y);
                const value = f1 * f1 + f2 * f2;
                if (value < bestValue) {
                    bestValue = value;
                    best = [x, y];
                }
            }
        }
        bestX = best[0];
        bestY = best[1];
        radius /= 8;
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(typeof frame.meta["converged"]).toBe("boolean");
    });
}

describe("Multivariate Newton's Method", () => {
    it("converges to a root matching an independent grid search", () => {
        const input = mod.defaultInput as { coefficients: Coeffs; start: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["converged"]).toBe(true);
        const root = last?.["root"] as number[];
        const [f1, f2] = evaluate(input.coefficients, root[0] as number, root[1] as number);
        expect(Math.hypot(f1, f2)).toBeLessThan(1e-8);
        const grid = gridRoot(input.coefficients);
        const [gridF1, gridF2] = evaluate(input.coefficients, grid[0], grid[1]);
        expect(Math.hypot(gridF1, gridF2)).toBeLessThan(1e-4);
        const onAnalyticRoot = (Math.abs(root[0] - 2) < 1e-6 && Math.abs(root[1] - 1) < 1e-6)
            || (Math.abs(root[0] + 1) < 1e-6 && Math.abs(root[1] + 2) < 1e-6);
        expect(onAnalyticRoot).toBe(true);
    });

    it("residual decreases along the trajectory", () => {
        const input = mod.defaultInput as { coefficients: Coeffs };
        const frames = [...mod.run(input)];
        const first = frames[0]?.meta["residual"] as number;
        const last = frames[frames.length - 1]?.meta["residual"] as number;
        expect(last).toBeLessThan(first);
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
