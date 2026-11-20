/** gauss-hermite.test.ts - Closed-form moment checks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./gauss-hermite";
import type { VisualFrame } from "@/types";

function exactMoment(power: number): number {
    if (power % 2 !== 0) {
        return 0;
    }
    const m = power / 2;
    let oddDoubleFactorial = 1;
    for (let j = 1; j <= m; j += 1) {
        oddDoubleFactorial *= 2 * j - 1;
    }
    return (Math.sqrt(Math.PI) * oddDoubleFactorial) / Math.pow(2, m);
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

describe("Gauss-Hermite quadrature", () => {
    it("reproduces the textbook two- and three-point rules", () => {
        const two = [...mod.run({ nodes: 2 })];
        checkFrames(two, mod.pseudocode?.length ?? 0);
        const twoMeta = two[two.length - 1]?.meta;
        const twoNodes = twoMeta?.["nodes"] as number[];
        const twoWeights = twoMeta?.["weights"] as number[];
        expect(twoNodes[0]).toBeCloseTo(-Math.SQRT1_2, 9);
        expect(twoNodes[1]).toBeCloseTo(Math.SQRT1_2, 9);
        expect(twoWeights[0]).toBeCloseTo(Math.sqrt(Math.PI) / 2, 9);
        expect(twoWeights[1]).toBeCloseTo(Math.sqrt(Math.PI) / 2, 9);

        const three = [...mod.run({ nodes: 3 })];
        checkFrames(three, mod.pseudocode?.length ?? 0);
        const threeMeta = three[three.length - 1]?.meta;
        const threeNodes = threeMeta?.["nodes"] as number[];
        const threeWeights = threeMeta?.["weights"] as number[];
        expect(threeNodes[0]).toBeCloseTo(-Math.sqrt(1.5), 9);
        expect(threeNodes[1]).toBeCloseTo(0, 9);
        expect(threeNodes[2]).toBeCloseTo(Math.sqrt(1.5), 9);
        expect(threeWeights[0]).toBeCloseTo(Math.sqrt(Math.PI) / 6, 9);
        expect(threeWeights[1]).toBeCloseTo((2 * Math.sqrt(Math.PI)) / 3, 9);
        expect(threeWeights[2]).toBeCloseTo(Math.sqrt(Math.PI) / 6, 9);
    });

    it("integrates every Gaussian monomial up to degree 2n-1 exactly", () => {
        for (const n of [2, 3, 4, 5]) {
            const frames = [...mod.run({ nodes: n })];
            const final = frames[frames.length - 1]?.meta;
            const nodes = final?.["nodes"] as number[];
            const weights = final?.["weights"] as number[];
            expect(nodes).toHaveLength(n);
            for (let power = 0; power <= 2 * n - 1; power += 1) {
                let quadrature = 0;
                for (let i = 0; i < n; i += 1) {
                    quadrature += (weights[i] ?? 0) * Math.pow(nodes[i] ?? 0, power);
                }
                expect(Math.abs(quadrature - exactMoment(power))).toBeLessThan(1e-9);
            }
            expect(Number(final?.["maxMomentError"])).toBeLessThan(1e-9);
            const weightSum = weights.reduce((sum, value) => sum + value, 0);
            expect(weightSum).toBeCloseTo(Math.sqrt(Math.PI), 9);
        }
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
