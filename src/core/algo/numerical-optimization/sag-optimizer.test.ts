/**
 * sag-optimizer.test.ts - Closed-form solution, average-gradient invariant,
 * convergence, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./sag-optimizer";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SAG optimizer", () => {
    const input = mod.defaultInput as { a: number[]; b: number[]; regularizer: number; iterations: number };

    it("reaches the closed-form minimizer", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.a.length);
        const final = frames[frames.length - 1]?.meta;
        const x = final?.["x"] as number[];
        const n = input.a.length;
        for (let i = 0; i < n; i += 1) {
            const expected = (input.a[i]! * input.b[i]!) / (input.a[i]! ** 2 + n * input.regularizer);
            expect(x[i]).toBeCloseTo(expected, 3);
        }
        expect(final?.["done"]).toBe(true);
    });

    it("keeps the running average equal to the mean of the gradient table", () => {
        const frames = [...mod.run(input)];
        const n = input.a.length;
        for (const frame of frames) {
            const table = frame.meta["gradientTable"] as number[];
            const average = frame.meta["average"] as number[];
            expect(table.length).toBe(n * n);
            for (let j = 0; j < n; j += 1) {
                let sum = 0;
                for (let i = 0; i < n; i += 1) sum += table[i * n + j] ?? 0;
                expect(Math.abs((average[j] ?? 0) - sum / n)).toBeLessThan(1e-6 + Math.abs(sum / n) * 1e-12);
            }
        }
    });

    it("reduces the distance to the optimum over a brute-force comparison", () => {
        const frames = [...mod.run({ ...input, iterations: 1200 })];
        const optimum = input.a.map((a, i) => (a * input.b[i]!) / (a * a + input.a.length * input.regularizer));
        const distance = (x: number[]) => Math.sqrt(x.reduce((sum, v, i) => sum + (v - optimum[i]!) ** 2, 0));
        const first = frames[0]!.meta["x"] as number[];
        const final = frames[frames.length - 1]!.meta["x"] as number[];
        expect(distance(final)).toBeLessThan(distance(first));
        expect(distance(final)).toBeLessThan(1e-2);

        // Reference: dense grid around the optimum cannot beat its objective.
        const objective = (x: number[]) => {
            let data = 0;
            for (let i = 0; i < input.a.length; i += 1) {
                data += 0.5 * (input.a[i]! * x[i]! - input.b[i]!) ** 2;
            }
            let reg = 0;
            for (const v of x) reg += 0.5 * input.regularizer * v * v;
            return data / input.a.length + reg;
        };
        let gridBest = Infinity;
        for (let i = -10; i <= 40; i += 1) {
            for (let j = -10; j <= 40; j += 1) {
                for (let k = -10; k <= 40; k += 1) {
                    gridBest = Math.min(gridBest, objective([i / 10, j / 10, k / 10]));
                }
            }
        }
        expect(objective(final)).toBeLessThanOrEqual(gridBest + 1e-6);
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
