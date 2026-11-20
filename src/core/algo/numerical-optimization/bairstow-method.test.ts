/**
 * bairstow-method.test.ts - Factor reconstruction and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bairstow-method";
import type { VisualFrame } from "@/types";

interface Root {
    re: number;
    im: number;
}

/** Multiply one factor per conjugate pair or real root, then compare coefficients. */
function reconstruct(roots: Root[]): number[] {
    let poly = [1];
    const used = new Set<number>();
    for (let i = 0; i < roots.length; i += 1) {
        if (used.has(i)) {
            continue;
        }
        const root = roots[i]!;
        let factor: number[];
        if (Math.abs(root.im) < 1e-9) {
            factor = [1, -root.re];
            used.add(i);
        } else {
            let conjugate = -1;
            for (let j = i + 1; j < roots.length; j += 1) {
                const other = roots[j]!;
                if (Math.abs(other.re - root.re) < 1e-6 && Math.abs(other.im + root.im) < 1e-6) {
                    conjugate = j;
                    break;
                }
            }
            expect(conjugate).toBeGreaterThan(i);
            used.add(i);
            used.add(conjugate);
            factor = [1, -2 * root.re, root.re * root.re + root.im * root.im];
        }
        const next = new Array<number>(poly.length + factor.length - 1).fill(0);
        for (let a = 0; a < poly.length; a += 1) {
            for (let b = 0; b < factor.length; b += 1) {
                next[a + b] = (next[a + b] ?? 0) + poly[a]! * factor[b]!;
            }
        }
        poly = next;
    }
    return poly;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(["array", "point"]).toContain(frame.layout);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bairstow method", () => {
    it("recovers roots that reconstruct the original quartic", () => {
        const coeff = [1, -3, 3, -3, 2];
        const frames = [...mod.run({ coefficients: coeff, r: 0.1, s: -0.9, iterations: 40 })];
        checkFrames(frames);
        const rawRoots = frames[frames.length - 1]?.meta["roots"] as number[][];
        const roots: Root[] = rawRoots.map((r) => ({ re: r[0] ?? 0, im: r[1] ?? 0 }));
        expect(roots.length).toBe(4);
        const poly = reconstruct(roots);
        expect(poly.length).toBe(coeff.length);
        for (let i = 0; i < coeff.length; i += 1) {
            expect(poly[i] ?? 0).toBeCloseTo(coeff[i] ?? 0, 4);
        }
    });

    it("finds the conjugate pair and the two real roots separately", () => {
        const frames = [...mod.run({ coefficients: [1, -3, 3, -3, 2], iterations: 40 })];
        const roots = (frames[frames.length - 1]?.meta["roots"] as number[][]).map((r) => ({
            re: r[0] ?? 0,
            im: r[1] ?? 0,
        }));
        const realRoots = roots.filter((r) => Math.abs(r.im) < 1e-6).map((r) => r.re).sort((a, b) => a - b);
        const imag = roots.filter((r) => Math.abs(r.im) >= 1e-6).map((r) => Math.abs(r.im));
        expect(realRoots[0]).toBeCloseTo(1, 4);
        expect(realRoots[1]).toBeCloseTo(2, 4);
        expect(imag[0]).toBeCloseTo(1, 4);
        expect(imag[1]).toBeCloseTo(1, 4);
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
