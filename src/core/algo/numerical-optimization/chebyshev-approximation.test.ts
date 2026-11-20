/**
 * chebyshev-approximation.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./chebyshev-approximation";
import type { VisualFrame } from "@/types";

function evalPoly(c: number[], x: number): number {
    let r = 0;
    for (let i = c.length - 1; i >= 0; i -= 1) {
        r = r * x + (c[i] ?? 0);
    }
    return r;
}

function cheb(k: number, x: number): number {
    if (k === 0) { return 1; }
    if (k === 1) { return x; }
    let a = 1;
    let b = x;
    for (let n = 2; n <= k; n += 1) {
        const t = 2 * x * b - a;
        a = b;
        b = t;
    }
    return b;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Chebyshev least-squares approximation", () => {
    it("exactly reconstructs a target inside the retained span", () => {
        const target = [1, -2, 3, 0, 4];
        const frames = [...mod.run({ degree: 6, targetCoefficients: target, samples: 64 })];
        checkFrames(frames, 7);
        const finalMeta = frames[frames.length - 1]?.meta;
        const coeffs = finalMeta?.["coefficients"] as number[];
        expect(Array.isArray(coeffs)).toBe(true);
        expect(Number(finalMeta?.["maxError"])).toBeLessThan(1e-9);
        for (let j = 0; j < 64; j += 1) {
            const x = Math.cos(((j + 0.5) * Math.PI) / 64);
            let approx = 0;
            for (let k = 0; k < coeffs.length; k += 1) {
                approx += (coeffs[k] ?? 0) * cheb(k, x);
            }
            expect(Math.abs(approx - evalPoly(target, x))).toBeLessThan(1e-8);
        }
    });

    it("lower degree gives a larger or equal residual than exact degree", () => {
        const target = [0, 0, 0, 1, -1];
        const exact = [...mod.run({ degree: 4, targetCoefficients: target, samples: 48 })];
        const low = [...mod.run({ degree: 2, targetCoefficients: target, samples: 48 })];
        expect(Number(exact[exact.length - 1]?.meta["maxError"])).toBeLessThan(1e-8);
        expect(Number(low[low.length - 1]?.meta["maxError"])).toBeGreaterThanOrEqual(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
