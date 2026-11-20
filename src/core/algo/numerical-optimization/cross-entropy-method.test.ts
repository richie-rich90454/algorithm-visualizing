/** cross-entropy-method.test.ts - Known optimum, brute-force grid comparison, determinism, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { crossEntropy, mulberry32 } from "./cross-entropy-method";
import type { VisualFrame } from "@/types";

const sphere = (p: number[]): number => ((p[0] ?? 0) - 2) ** 2 + ((p[1] ?? 0) + 1) ** 2;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Cross-entropy method", () => {
    it("uses a reproducible generator", () => {
        const a = mulberry32(123);
        const b = mulberry32(123);
        for (let i = 0; i < 100; i += 1) {
            expect(a()).toBe(b());
        }
        expect(mulberry32(1)()).not.toBe(mulberry32(2)());
    });

    it("converges to the known sphere minimum with monotone best values", () => {
        const result = crossEntropy(sphere, 2, { samples: 60, elite: 0.2, iterations: 60, seed: 7, mean: [0, 0], sigma: [3, 3] });
        expect(result.best[0]).toBeCloseTo(2, 1);
        expect(result.best[1]).toBeCloseTo(-1, 1);
        expect(result.bestValue).toBeLessThan(0.5);
        for (let i = 1; i < result.history.length; i += 1) {
            expect(result.history[i]?.bestValue ?? 0).toBeLessThanOrEqual(result.history[i - 1]?.bestValue ?? 0);
        }
    });

    it("matches or beats a brute-force grid search", () => {
        let gridBest = Infinity;
        for (let x = -4; x <= 4; x += 0.25) {
            for (let y = -5; y <= 3; y += 0.25) {
                gridBest = Math.min(gridBest, sphere([x, y]));
            }
        }
        const result = crossEntropy(sphere, 2, { samples: 60, elite: 0.2, iterations: 60, seed: 7, mean: [0, 0], sigma: [3, 3] });
        expect(result.bestValue).toBeLessThanOrEqual(gridBest + 1e-8);
    });

    it("gives identical results for the same seed", () => {
        const options = { samples: 30, elite: 0.2, iterations: 15, seed: 42, mean: [0, 0], sigma: [3, 3] };
        const first = crossEntropy(sphere, 2, options);
        const second = crossEntropy(sphere, 2, options);
        expect(first.best).toEqual(second.best);
        expect(first.bestValue).toBe(second.bestValue);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["bestValue"] as number).toBeLessThan(1);
        expect(generator.next().done).toBe(true);
    });
});
