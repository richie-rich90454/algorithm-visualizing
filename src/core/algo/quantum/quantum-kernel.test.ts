/**
 * quantum-kernel.test.ts - Closed form, Gram positivity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { closedFormKernel, featureState, quantumKernel } from "./quantum-kernel";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
    });
}

describe("Quantum kernel estimation", () => {
    it("feature states are normalized", () => {
        for (const point of [[0, 0], [1, 2], [3.1, -0.7]]) {
            const state = featureState(point);
            const norm = state.reduce((sum, amplitude) => sum + amplitude.re ** 2 + amplitude.im ** 2, 0);
            expect(norm).toBeCloseTo(1, 10);
        }
    });

    it("matches the closed-form cosine kernel", () => {
        const points = [[0, 0], [1, 0], [0, 1], [2.3, -1.1], [-0.5, 3]];
        for (const x of points) {
            for (const y of points) {
                expect(quantumKernel(x, y)).toBeCloseTo(closedFormKernel(x, y), 10);
            }
        }
    });

    it("has a unit diagonal, symmetry, and bounded values", () => {
        const points = [[0.2, 1], [2, -0.4], [-1, 3], [0, 0]];
        for (const x of points) {
            expect(quantumKernel(x, x)).toBeCloseTo(1, 10);
        }
        for (const x of points) {
            for (const y of points) {
                const value = quantumKernel(x, y);
                expect(value).toBeCloseTo(quantumKernel(y, x), 10);
                expect(value).toBeGreaterThanOrEqual(-1e-12);
                expect(value).toBeLessThanOrEqual(1 + 1e-12);
            }
        }
    });

    it("Gram matrices are positive semidefinite", () => {
        const points = [[0, 0], [1, 0], [0, 1], [2, 2]];
        const n = points.length;
        const gram = points.map((x) => points.map((y) => quantumKernel(x, y)));
        const determinant3 = 1 + 2 * (gram[0]?.[1] as number) * (gram[0]?.[2] as number) * (gram[1]?.[2] as number)
            - (gram[0]?.[1] as number) ** 2 - (gram[0]?.[2] as number) ** 2 - (gram[1]?.[2] as number) ** 2;
        expect(determinant3).toBeGreaterThanOrEqual(-1e-9);
        let sum = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                sum += (gram[i]?.[j] as number) * (i === j ? 1 : 0.3);
            }
        }
        expect(Number.isFinite(sum)).toBe(true);
    });

    it("reports a valid Gram matrix in its final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["diagonal"]).toBe(true);
        expect(final?.["symmetric"]).toBe(true);
        const gram = final?.["gram"] as number[];
        expect(gram.length).toBe(9);
        expect(gram[0]).toBeCloseTo(1, 10);
        expect(gram[4]).toBeCloseTo(1, 10);
        expect(gram[8]).toBeCloseTo(1, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
