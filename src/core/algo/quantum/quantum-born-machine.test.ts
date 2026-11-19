/**
 * quantum-born-machine.test.ts - Independent grid search, normalization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-born-machine";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const values = frame.entities.map((e) => e.value as number);
        for (const value of values) {
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
        }
    });
    expect(count).toBe(4);
}

/** Independent Born distribution from a direct state-vector construction. */
function distribution(t0: number, t1: number): number[] {
    const c0 = Math.cos(t0 / 2);
    const s0 = Math.sin(t0 / 2);
    const c1 = Math.cos(t1 / 2);
    const s1 = Math.sin(t1 / 2);
    return [c0 * c1, c0 * s1, s0 * s1, s0 * c1].map((amplitude) => amplitude ** 2);
}

function totalVariation(a: number[], b: number[]): number {
    return 0.5 * a.reduce((sum, value, i) => sum + Math.abs(value - (b[i] ?? 0)), 0);
}

describe("QuantumBornMachine", () => {
    it("finds the global grid optimum and a normalized output distribution", () => {
        for (const target of [[0.1, 0.2, 0.3, 0.4], [0.25, 0.25, 0.25, 0.25], [0.7, 0.1, 0.1, 0.1]]) {
            const gridPoints = 9;
            const frames = [...mod.run({ target, gridPoints })];
            checkFrames(frames, target.length);
            const meta = frames[frames.length - 1]?.meta;
            const grid = Array.from({ length: gridPoints }, (_, i) => (Math.PI * i) / (gridPoints - 1));
            let bestLoss = Number.POSITIVE_INFINITY;
            let best0 = 0;
            let best1 = 0;
            for (const t0 of grid) {
                for (const t1 of grid) {
                    const loss = totalVariation(distribution(t0, t1), target);
                    if (loss < bestLoss) {
                        bestLoss = loss;
                        best0 = t0;
                        best1 = t1;
                    }
                }
            }
            expect(meta?.["bestLoss"] as number).toBeCloseTo(bestLoss, 10);
            expect(meta?.["bestTheta0"] as number).toBeCloseTo(best0, 10);
            expect(meta?.["bestTheta1"] as number).toBeCloseTo(best1, 10);
            const learned = meta?.["distribution"] as number[];
            expect(learned.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
            for (let i = 0; i < 4; i += 1) {
                expect(learned[i]).toBeCloseTo(distribution(best0, best1)[i] ?? 0, 10);
            }
        }
    });

    it("normalizes a target that does not sum to one", () => {
        const frames = [...mod.run({ target: [2, 1, 1, 0], gridPoints: 5 })];
        const target = frames[0]?.meta["target"] as number[];
        expect(target.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
