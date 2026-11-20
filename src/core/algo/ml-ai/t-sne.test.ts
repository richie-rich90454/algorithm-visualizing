/**
 * t-sne.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./t-sne";
import type { VisualFrame } from "@/types";

function unpack(flat: number[], n: number, width: number): number[][] {
    return Array.from({ length: n }, (_v, i) =>
        Array.from({ length: width }, (_x, j) => flat[i * width + j] ?? 0),
    );
}

function squaredDistance(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + (value - (b[i] ?? 0)) ** 2, 0);
}

function klFrom(P: number[][], Y: number[][]): number {
    const n = Y.length;
    let total = 0;
    const numerators = Array.from({ length: n }, () => Array(n).fill(0));
    let z = 0;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (i === j) {
                continue;
            }
            const value = 1 / (1 + squaredDistance(Y[i] ?? [], Y[j] ?? []));
            numerators[i][j] = value;
            z += value;
        }
    }
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            if (i === j) {
                continue;
            }
            const p = P[i]?.[j] ?? 0;
            const q = z > 0 ? (numerators[i]?.[j] ?? 0) / z : 0;
            if (q > 0) {
                total += p * Math.log(p / q);
            }
        }
    }
    return total;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Number.isFinite(frame.entities[0]?.x)).toBe(true);
        expect(Number.isFinite(frame.entities[0]?.y)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("t-SNE (KL Gradient Step)", () => {
    it("reported KL matches an independent recomputation", () => {
        const input = mod.defaultInput as { points: number[][]; perplexity: number; iterations: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.points.length);
        const final = frames[frames.length - 1]?.meta ?? {};
        const n = Number(final["n"]);
        const P = unpack(final["P"] as number[], n, n);
        const Y = unpack(final["Y"] as number[], n, 2);
        expect(Number(final["KL"])).toBeCloseTo(klFrom(P, Y), 9);
    });

    it("analytic gradient matches central finite differences", () => {
        const input = mod.defaultInput as { points: number[][]; iterations: number };
        const frames = [...mod.run({ ...input, iterations: 2 })];
        const frame = frames[1]?.meta ?? {};
        const n = Number(frame["n"]);
        const P = unpack(frame["P"] as number[], n, n);
        const grad = unpack(frame["grad"] as number[], n, 2);
        const Y = unpack(frame["Y"] as number[], n, 2);
        // The reported Y is after the step; reconstruct the pre-step Y using grad and lr.
        const lr = 50;
        const before = Y.map((row, i) => [
            (row[0] ?? 0) + lr * (grad[i]?.[0] ?? 0),
            (row[1] ?? 0) + lr * (grad[i]?.[1] ?? 0),
        ]);
        const eps = 1e-5;
        for (let i = 0; i < n; i += 1) {
            for (let d = 0; d < 2; d += 1) {
                const plus = before.map((row) => [...row]);
                const minus = before.map((row) => [...row]);
                plus[i][d] = (plus[i]?.[d] ?? 0) + eps;
                minus[i][d] = (minus[i]?.[d] ?? 0) - eps;
                const numeric = (klFrom(P, plus) - klFrom(P, minus)) / (2 * eps);
                expect(grad[i]?.[d]).toBeCloseTo(numeric, 4);
            }
        }
    });

    it("moves points to a lower-dimensional map with finite coordinates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta ?? {};
        const Y = final["Y"] as number[];
        expect(Y.length).toBeGreaterThan(0);
        expect(Y.every((value) => Number.isFinite(value))).toBe(true);
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
