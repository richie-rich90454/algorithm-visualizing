/**
 * local-linear-embedding.test.ts - Brute-force weight optimality, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./local-linear-embedding";
import type { VisualFrame } from "@/types";

/** Brute-force best reconstruction error over one free weight for k = 2 neighbors. */
function bruteError(points: number[][], i: number, neighbors: number[], w: number): number {
    const other = 1 - w;
    let error = 0;
    const dim = (points[i] as number[]).length;
    for (let d = 0; d < dim; d += 1) {
        const reconstructed = w * (points[neighbors[0] as number]?.[d] as number) + other * (points[neighbors[1] as number]?.[d] as number);
        error += ((points[i]?.[d] as number) - reconstructed) ** 2;
    }
    return Math.sqrt(error);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Locally Linear Embedding", () => {
    it("reconstructs collinear points exactly with normalized weights", () => {
        const points = [
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0],
        ];
        const frames = [...mod.run({ points, k: 2 })];
        checkFrames(frames, points.length);
        const final = frames[frames.length - 1];
        const errors = final?.meta["errors"] as number[];
        const weights = final?.meta["weights"] as number[][];
        errors.forEach((error) => expect(error).toBeLessThan(1e-6));
        weights.forEach((w) => expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8));
        expect(weights[2]).toEqual([0.5, 0.5]);
        expect(final?.meta["totalError"] as number).toBeLessThan(1e-5);
    });

    it("matches a brute-force optimum of the reconstruction weights", () => {
        const points = [
            [0, 0], [1, 0.1], [2, -0.2], [3, 0.4], [4, 0.1], [5, 0.3],
        ];
        const final = [...mod.run({ points, k: 2 })].at(-1);
        const errors = final?.meta["errors"] as number[];
        const neighbors = final?.meta["neighbors"] as number[][];
        const weights = final?.meta["weights"] as number[][];
        for (let i = 0; i < points.length; i += 1) {
            let best = Infinity;
            for (let step = -600; step <= 600; step += 1) {
                best = Math.min(best, bruteError(points, i, neighbors[i] as number[], step / 200));
            }
            expect(errors[i] as number).toBeLessThanOrEqual(best + 1e-7);
            expect((weights[i] as number[]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
        }
        const embedding = final?.meta["embedding"] as number[];
        expect(embedding.length).toBe(points.length);
        expect(embedding.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 8);
        expect(embedding.every((value) => Number.isFinite(value))).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
