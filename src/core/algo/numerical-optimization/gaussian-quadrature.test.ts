/**
 * gaussian-quadrature.test.ts - Exactness on monomials, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gaussian-quadrature";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Number.isFinite(frame.entities[0]?.x)).toBe(true);
        expect(Number.isFinite(frame.entities[0]?.y)).toBe(true);
    });
}

describe("GaussianQuadrature", () => {
    it("matches the closed-form two-point nodes and weights", () => {
        const frames = [...mod.run({ n: 2 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const nodes = [...(final?.["nodes"] as number[])].sort((a, b) => a - b);
        const weights = final?.["weights"] as number[];
        expect(nodes[0]).toBeCloseTo(-1 / Math.sqrt(3), 10);
        expect(nodes[1]).toBeCloseTo(1 / Math.sqrt(3), 10);
        expect(weights[0]).toBeCloseTo(1, 10);
        expect(weights[1]).toBeCloseTo(1, 10);
    });

    it("integrates every monomial up to degree 2n-1 exactly", () => {
        for (const n of [2, 3, 4]) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const nodes = final?.["nodes"] as number[];
            const weights = final?.["weights"] as number[];
            expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(2, 10);
            for (let k = 0; k <= 2 * n - 1; k += 1) {
                let sum = 0;
                for (let i = 0; i < nodes.length; i += 1) {
                    sum += (weights[i] ?? 0) * (nodes[i] ?? 0) ** k;
                }
                const exact = k % 2 === 1 ? 0 : 2 / (k + 1);
                expect(sum).toBeCloseTo(exact, 8);
            }
        }
    });

    it("reports the correct integral of x squared", () => {
        const frames = [...mod.run({ n: 2 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["integral"]).toBeCloseTo(2 / 3, 10);
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
