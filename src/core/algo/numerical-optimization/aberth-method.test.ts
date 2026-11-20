/**
 * aberth-method.test.ts - Independent reference iteration, root checks, and frames.
 */

import { describe, expect, it } from "vitest";
import mod from "./aberth-method";
import type { VisualFrame } from "@/types";

type Complex = [number, number];

const add = (a: Complex, b: Complex): Complex => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Complex, b: Complex): Complex => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Complex, b: Complex): Complex => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const abs = (a: Complex): number => Math.hypot(a[0], a[1]);
const div = (a: Complex, b: Complex): Complex => {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};

function evaluate(coeff: number[], z: Complex): Complex {
    let p: Complex = [coeff[0] ?? 1, 0];
    for (let i = 1; i < coeff.length; i += 1) {
        p = add(mul(p, z), [coeff[i] ?? 0, 0]);
    }
    return p;
}

/** Independent Aberth-Ehrlich iteration. */
function reference(coeff: number[], iterations: number): Complex[] {
    const n = coeff.length - 1;
    const dcoeff = coeff.slice(0, -1).map((c, i) => c * (n - i));
    let roots: Complex[] = [];
    let seed: Complex = [0.4, 0.9];
    for (let i = 0; i < n; i += 1) {
        roots.push(i === 0 ? [1, 0] : seed);
        seed = mul(seed, [0.4, 0.9]);
    }
    for (let iter = 0; iter < iterations; iter += 1) {
        roots = roots.map((z, i) => {
            const step = div(evaluate(coeff, z), evaluate(dcoeff, z));
            let sum: Complex = [0, 0];
            for (let j = 0; j < n; j += 1) {
                if (j === i) {
                    continue;
                }
                sum = add(sum, div([1, 0], sub(z, roots[j] as Complex)));
            }
            return sub(z, div(step, sub([1, 0], mul(step, sum))));
        });
    }
    return roots;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Aberth method", () => {
    it("matches an independent reference and finds three real roots", () => {
        const coeff = [1, -6, 11, -6];
        const frames = [...mod.run({ coefficients: coeff, iterations: 30 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const roots = final?.["roots"] as number[][];
        const expected = reference(coeff, 30);
        const actual = roots.map((r) => [r[0] ?? 0, r[1] ?? 0] as Complex);
        for (let i = 0; i < actual.length; i += 1) {
            expect(abs(sub(actual[i] as Complex, expected[i] as Complex))).toBeLessThan(1e-6);
        }
        const sorted = roots.map((r) => r[0]).sort((a, b) => a - b);
        expect(sorted[0]).toBeCloseTo(1, 5);
        expect(sorted[1]).toBeCloseTo(2, 5);
        expect(sorted[2]).toBeCloseTo(3, 5);
    });

    it("recovers a complex conjugate pair", () => {
        const frames = [...mod.run({ coefficients: [1, 0, 1], iterations: 40 })];
        const roots = frames[frames.length - 1]?.meta["roots"] as number[][];
        const sorted = [...roots].sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));
        expect(sorted[0]?.[0]).toBeCloseTo(0, 4);
        expect(sorted[0]?.[1]).toBeCloseTo(-1, 4);
        expect(sorted[1]?.[0]).toBeCloseTo(0, 4);
        expect(sorted[1]?.[1]).toBeCloseTo(1, 4);
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
