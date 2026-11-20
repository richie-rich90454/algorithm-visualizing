/** hqq-quantization.test.ts - Brute-force proximal check, grid properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { hqqSolve, quantProject, softThreshold } from "./hqq-quantization";
import type { VisualFrame } from "@/types";

interface Input {
    weights: number[];
    bits: number;
    lambda: number;
    beta: number;
    iterations: number;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

/** Brute-force minimize 0.5 (v-x)^2 + t |v| over a fine grid. */
function bruteSoft(x: number, t: number): number {
    let best = x;
    let bestVal = Infinity;
    for (let k = -2000; k <= 2000; k += 1) {
        const v = k / 1000;
        const val = 0.5 * (v - x) ** 2 + t * Math.abs(v);
        if (val < bestVal) {
            bestVal = val;
            best = v;
        }
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Half-quadratic quantization", () => {
    it("soft threshold matches a brute-force proximal minimizer", () => {
        for (const [x, t] of [[0.7, 0.2], [-0.7, 0.2], [0.1, 0.5], [-0.1, 0.5], [2, 0.3]]) {
            expect(close(softThreshold(x, t), bruteSoft(x, t), 1e-3)).toBe(true);
        }
        expect(softThreshold(0.05, 0.1)).toBe(0);
    });

    it("grid projection picks the nearest level and stays in range", () => {
        expect(close(quantProject(0.26, 0, 0.25, 4), 0.25)).toBe(true);
        expect(close(quantProject(0.13, 0, 0.25, 4), 0.25)).toBe(true);
        expect(close(quantProject(-5, 0, 0.25, 4), 0)).toBe(true);
        expect(close(quantProject(9, 0, 0.25, 4), 0.75)).toBe(true);
    });

    it("reconstruction lies on the grid and reduces toward the input", () => {
        const weights = [-1.2, -0.4, 0, 0.3, 0.9, 1.4];
        const { reconstruction, errors, min, step, levels } = hqqSolve(weights, 3, 0.15, 1, 4);
        expect(reconstruction.length).toBe(weights.length);
        expect(errors.length).toBe(4);
        for (const v of reconstruction) {
            const idx = Math.round((v - min) / step);
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(levels);
            expect(close(v, min + idx * step)).toBe(true);
        }
        // A uniform grid with this range and 3 bits has a bounded quantization error.
        expect(errors[0]!).toBeLessThan(0.1);
    });

    it("handles constant and empty weights without NaN", () => {
        const constant = hqqSolve([2, 2, 2], 4, 0.1, 1, 2);
        expect(constant.reconstruction.every((v) => Number.isFinite(v))).toBe(true);
        const empty = hqqSolve([], 4, 0.1, 1, 2);
        expect(empty.reconstruction.length).toBe(0);
    });

    it("matches the solve through the module run metadata", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = hqqSolve(input.weights, input.bits, input.lambda, input.beta, input.iterations);
        const final = frames[frames.length - 1]?.meta;
        const reconstructed = final?.["reconstruction"] as number[];
        reconstructed.forEach((v, i) => expect(close(v, expected.reconstruction[i]!)).toBe(true));
        expect(final?.["mse"]).toBe(expected.errors[expected.errors.length - 1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
