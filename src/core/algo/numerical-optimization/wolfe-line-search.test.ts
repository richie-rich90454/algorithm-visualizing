/**
 * wolfe-line-search.test.ts - Wolfe-condition properties, reference cross-check,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./wolfe-line-search";
import type { VisualFrame } from "@/types";

interface Input {
    a: number;
    b: number;
    c: number;
    alpha0: number;
    c1: number;
    c2: number;
    alphaMax: number;
    maxIter: number;
}

const phi = (alpha: number, p: Input): number => p.a * alpha * alpha + p.b * alpha + p.c;
const slope = (alpha: number, p: Input): number => 2 * p.a * alpha + p.b;

/** Independent plain implementation of the strong Wolfe expand-and-zoom search. */
function reference(p: Input): number {
    const p0 = phi(0, p);
    const dp0 = slope(0, p);
    const armijo = (alpha: number): number => p0 + p.c1 * alpha * dp0;

    function zoom(lo: number, hi: number): number {
        const phiLo = phi(lo, p);
        for (let j = 0; j < p.maxIter; j += 1) {
            const mid = (lo + hi) / 2;
            const pMid = phi(mid, p);
            const dMid = slope(mid, p);
            if (pMid > armijo(mid) || pMid >= phiLo) {
                hi = mid;
            } else {
                if (Math.abs(dMid) <= -p.c2 * dp0) {
                    return mid;
                }
                if (dMid * (hi - lo) >= 0) {
                    hi = lo;
                }
                lo = mid;
            }
        }
        return lo;
    }

    let alpha0 = p.alpha0;
    let lo = 0;
    let previous = p0;
    for (let i = 0; i < p.maxIter; i += 1) {
        const pI = phi(alpha0, p);
        const dI = slope(alpha0, p);
        if (pI > armijo(alpha0) || (i > 0 && pI >= previous)) {
            return zoom(lo, alpha0);
        }
        if (Math.abs(dI) <= -p.c2 * dp0) {
            return alpha0;
        }
        if (dI >= 0) {
            return zoom(alpha0, lo);
        }
        previous = pI;
        lo = alpha0;
        alpha0 = Math.min(2 * alpha0, p.alphaMax);
        if (lo >= p.alphaMax) {
            break;
        }
    }
    return lo;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Strong Wolfe line search", () => {
    it("matches an independent reference and satisfies both Wolfe conditions", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const alpha = Number(finalMeta?.["alpha"]);
        expect(finalMeta?.["accepted"]).toBe(true);
        expect(alpha).toBeCloseTo(reference(input), 9);
        expect(alpha).toBeGreaterThan(0);
        expect(alpha).toBeLessThanOrEqual(input.alphaMax);

        const p0 = phi(0, input);
        const dp0 = slope(0, input);
        const pAlpha = phi(alpha, input);
        const dAlpha = slope(alpha, input);
        expect(pAlpha).toBeLessThanOrEqual(p0 + input.c1 * alpha * dp0 + 1e-9);
        expect(Math.abs(dAlpha)).toBeLessThanOrEqual(-input.c2 * dp0 + 1e-9);
    });

    it("reduces the objective below its starting value", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["phi"])).toBeLessThan(phi(0, input));
    });

    it("finds an acceptable step when the first trial is already valid", () => {
        const input = { a: 1, b: -6, c: 9, alpha0: 1, c1: 0.0001, c2: 0.9, alphaMax: 100, maxIter: 50 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["accepted"]).toBe(true);
        expect(Number(finalMeta?.["alpha"])).toBeCloseTo(reference(input), 9);
        expect(Math.abs(Number(finalMeta?.["slope"]))).toBeLessThanOrEqual(-input.c2 * slope(0, input) + 1e-9);
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
