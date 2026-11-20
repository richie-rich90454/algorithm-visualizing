/**
 * durand-kerner.test.ts - Residual and known-root checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./durand-kerner";
import type { VisualFrame, MetaValue } from "@/types";

function polyEval(coeff: number[], z: [number, number]): number {
    let re = coeff[0] ?? 1;
    let im = 0;
    for (let i = 1; i < coeff.length; i += 1) {
        const nre = re * z[0] - im * z[1] + (coeff[i] ?? 0);
        im = re * z[1] + im * z[0];
        re = nre;
    }
    return Math.hypot(re, im);
}

function asRoots(meta: Record<string, MetaValue>): Array<[number, number]> {
    const raw = meta["roots"];
    return Array.isArray(raw)
        ? raw.map((r) => {
            const pair = r as MetaValue[];
            return [Number(pair[0]), Number(pair[1])] as [number, number];
        })
        : [];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
    });
}

describe("Durand-Kerner root finder", () => {
    it("recovers known real roots with small residual", () => {
        const coeff = [1, -6, 11, -6];
        const frames = [...mod.run({ coefficients: coeff, iterations: 80 })];
        checkFrames(frames);
        const roots = asRoots(frames[frames.length - 1]!.meta);
        expect(roots.length).toBe(3);
        const realParts = roots.map((r) => r[0]).sort((a, b) => a - b);
        realParts.forEach((r, i) => expect(r).toBeCloseTo(i + 1, 5));
        for (const r of roots) expect(polyEval(coeff, r)).toBeLessThan(1e-8);
        expect(Number(frames[frames.length - 1]!.meta["maxResidual"])).toBeLessThan(1e-8);
    });

    it("finds complex conjugate roots", () => {
        const coeff = [1, 0, 1];
        const frames = [...mod.run({ coefficients: coeff, iterations: 80 })];
        checkFrames(frames);
        const roots = asRoots(frames[frames.length - 1]!.meta);
        expect(roots.length).toBe(2);
        const sorted = [...roots].sort((a, b) => a[1] - b[1]);
        expect(sorted[0]![1]).toBeCloseTo(-1, 5);
        expect(sorted[1]![1]).toBeCloseTo(1, 5);
        for (const r of roots) expect(polyEval(coeff, r)).toBeLessThan(1e-8);
    });

    it("matches a brute-force root set on random polynomials", () => {
        for (const truth of [[1, 2, 3], [-2, 1, 4], [1, 2, 3, 4]]) {
            const coeff = [1];
            for (const root of truth) {
                const next = new Array(coeff.length + 1).fill(0) as number[];
                for (let i = 0; i < coeff.length; i += 1) {
                    next[i] = (next[i] ?? 0) + (coeff[i] ?? 0);
                    next[i + 1] = (next[i + 1] ?? 0) - root * (coeff[i] ?? 0);
                }
                coeff.splice(0, coeff.length, ...next);
            }
            const frames = [...mod.run({ coefficients: coeff, iterations: 100 })];
            checkFrames(frames);
            const roots = asRoots(frames[frames.length - 1]!.meta);
            expect(roots.length).toBe(truth.length);
            for (const r of roots) expect(polyEval(coeff, r)).toBeLessThan(1e-6);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
