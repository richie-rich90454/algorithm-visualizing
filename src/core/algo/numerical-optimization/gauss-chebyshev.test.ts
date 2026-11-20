/** gauss-chebyshev.test.ts - Brute-force moment checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./gauss-chebyshev";
import type { VisualFrame } from "@/types";

/** Closed-form integral of x^power / sqrt(1 - x^2) on [-1, 1]. */
function exactMoment(power: number): number {
    if (power % 2 !== 0) {
        return 0;
    }
    const m = power / 2;
    let center = 1;
    for (let k = 0; k < m; k += 1) {
        center = (center * (2 * m - k)) / (k + 1);
    }
    return (Math.PI * center) / Math.pow(4, m);
}

function checkFrames(frames: VisualFrame[], codeLines: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(codeLines);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        });
    });
}

describe("Gauss-Chebyshev quadrature", () => {
    it("matches the closed-form rule and integrates all exact moments", () => {
        for (const n of [2, 3, 4, 5]) {
            const frames = [...mod.run({ nodes: n, samplePower: 4 })];
            checkFrames(frames, mod.pseudocode?.length ?? 0);
            const final = frames[frames.length - 1]?.meta;
            const nodes = final?.["nodes"] as number[];
            const weights = final?.["weights"] as number[];
            expect(nodes).toHaveLength(n);
            for (let i = 0; i < n; i += 1) {
                expect(nodes[i]).toBeCloseTo(Math.cos((Math.PI * (2 * (i + 1) - 1)) / (2 * n)), 12);
                expect(weights[i]).toBeCloseTo(Math.PI / n, 12);
            }
            for (let power = 0; power <= 2 * n - 1; power += 1) {
                let quadrature = 0;
                for (let i = 0; i < n; i += 1) {
                    quadrature += (weights[i] ?? 0) * Math.pow(nodes[i] ?? 0, power);
                }
                expect(Math.abs(quadrature - exactMoment(power))).toBeLessThan(1e-10);
            }
            expect(Number(final?.["maxExactnessError"])).toBeLessThan(1e-10);
            const samplePower = Number(final?.["samplePower"]);
            expect(Math.abs(Number(final?.["sampleEstimate"]) - exactMoment(samplePower))).toBeLessThan(1e-10);
        }
    });

    it("does not claim exactness beyond degree 2n-1", () => {
        const n = 3;
        const frames = [...mod.run({ nodes: n })];
        const final = frames[frames.length - 1]?.meta;
        const nodes = final?.["nodes"] as number[];
        const weights = final?.["weights"] as number[];
        let quadrature = 0;
        for (let i = 0; i < n; i += 1) {
            quadrature += (weights[i] ?? 0) * Math.pow(nodes[i] ?? 0, 2 * n);
        }
        expect(Math.abs(quadrature - exactMoment(2 * n))).toBeGreaterThan(0.05);
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
