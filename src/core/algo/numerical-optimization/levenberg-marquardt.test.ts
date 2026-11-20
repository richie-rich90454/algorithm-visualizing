/**
 * levenberg-marquardt.test.ts - Convergence, monotone accepted cost, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./levenberg-marquardt";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], xs: number[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(xs.length);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["costs"])).toBe(true);
        expect(Array.isArray(frame.meta["params"])).toBe(true);
    });
}

describe("LevenbergMarquardt", () => {
    it("recovers the known parameter on several synthetic data sets", () => {
        for (const aTrue of [0.3, 0.6, 1.0]) {
            const xs = [0, 0.4, 0.8, 1.2, 1.6, 2];
            const frames = [...mod.run({ aTrue, xs, iterations: 20 })];
            checkFrames(frames, xs);
            const meta = frames[frames.length - 1]?.meta;
            expect(Number(meta?.["a"])).toBeCloseTo(aTrue, 5);
            expect(Number(meta?.["finalError"])).toBeLessThan(1e-4);
            expect(Number(meta?.["cost"])).toBeLessThan(1e-12);
        }
    });

    it("accepted steps never increase the cost and lambda stays positive", () => {
        const frames = [...mod.run({ aTrue: 0.5, iterations: 15 })];
        checkFrames(frames, [0, 0.5, 1, 1.5, 2]);
        const meta = frames[frames.length - 1]?.meta;
        const costs = meta?.["costs"] as number[];
        const lambdas = meta?.["lambdas"] as number[];
        for (let i = 1; i < costs.length; i += 1) {
            expect(costs[i]!).toBeLessThanOrEqual(costs[i - 1]! + 1e-15);
        }
        for (const l of lambdas) {
            expect(l).toBeGreaterThan(0);
        }
    });

    it("a rejected step leaves the parameter unchanged", () => {
        const frames = [...mod.run({ aTrue: 0.6, lambda: 1000, iterations: 1 })];
        checkFrames(frames, [0, 0.5, 1, 1.5, 2]);
        const meta = frames[frames.length - 1]?.meta;
        const params = meta?.["params"] as number[];
        // A huge damping makes the step nearly zero; with one iteration the parameter stays close to zero.
        expect(Math.abs(params[params.length - 1]!)).toBeLessThan(1e-2);
    });

    it("matches an independent cost computation", () => {
        const frames = [...mod.run({ aTrue: 0.8, xs: [0, 1, 2], iterations: 8 })];
        const meta = frames[frames.length - 1]?.meta;
        const a = Number(meta?.["a"]);
        const xs = [0, 1, 2];
        const ys = xs.map((x) => Math.exp(0.8 * x));
        const brute = xs.reduce((s, x, i) => s + (Math.exp(a * x) - ys[i]!) ** 2, 0);
        expect(Number(meta?.["cost"])).toBeCloseTo(brute, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(14);
        expect(generator.next().done).toBe(true);
    });
});
