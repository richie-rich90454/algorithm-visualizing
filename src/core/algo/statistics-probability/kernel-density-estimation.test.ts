/**
 * kernel-density-estimation.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./kernel-density-estimation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent Gaussian KDE evaluation used as a reference. */
function referenceDensity(query: number, values: number[], h: number): number {
    let sum = 0;
    for (const value of values) {
        const u = (query - value) / h;
        sum += Math.exp(-u * u / 2) / Math.sqrt(2 * Math.PI);
    }
    return sum / (values.length * h);
}

describe("Kernel Density Estimation", () => {
    it("matches an independent Gaussian kernel evaluation at every query point", () => {
        const values = [1, 2, 3, 4, 5];
        const bandwidth = 1.2;
        const query = [0, 1, 1.5, 3, 4.5, 6, 8];
        const frames = [...mod.run({ values, bandwidth, query })];
        checkFrames(frames, query.length);
        const densities = frames[frames.length - 1]?.meta["densities"] as number[];
        expect(densities.length).toBe(query.length);
        for (let i = 0; i < query.length; i += 1) {
            expect(densities[i] ?? 0).toBeCloseTo(referenceDensity(query[i] ?? 0, values, bandwidth), 10);
        }
    });

    it("integrates to one on a fine grid and is symmetric for symmetric data", () => {
        const values = [-2, -1, 0, 1, 2];
        const bandwidth = 0.7;
        const lo = -6;
        const hi = 6;
        const steps = 2000;
        const query = Array.from({ length: steps + 1 }, (_, i) => lo + ((hi - lo) * i) / steps);
        const frames = [...mod.run({ values, bandwidth, query })];
        const densities = frames[frames.length - 1]?.meta["densities"] as number[];
        const dx = (hi - lo) / steps;
        let area = 0;
        for (let i = 0; i < densities.length; i += 1) {
            const weight = i === 0 || i === densities.length - 1 ? 0.5 : 1;
            area += weight * (densities[i] ?? 0) * dx;
        }
        expect(area).toBeCloseTo(1, 2);
        const symmetricFrames = [...mod.run({ values, bandwidth, query: [-3, -1, 0, 1, 3] })];
        const symmetric = symmetricFrames[symmetricFrames.length - 1]?.meta["densities"] as number[];
        expect(symmetric[0]).toBeCloseTo(symmetric[4] ?? 0, 10);
        expect(symmetric[1]).toBeCloseTo(symmetric[3] ?? 0, 10);
    });

    it("terminates", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
