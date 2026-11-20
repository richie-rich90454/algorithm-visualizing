/**
 * chudnovsky-pi-algorithm.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./chudnovsky-pi-algorithm";
import type { VisualFrame } from "@/types";

const A0 = 13591409;
const A1 = 545140134;
const C = 426880 * Math.sqrt(10005);

function factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i += 1) {
        result *= i;
    }
    return result;
}

/** Independent closed-form Chudnovsky partial sum using factorials. */
function reference(terms: number): number {
    let sum = 0;
    for (let k = 0; k < terms; k += 1) {
        const sign = k % 2 === 0 ? 1 : -1;
        const numerator = factorial(6 * k) * (A0 + A1 * k);
        const denominator = factorial(3 * k) * Math.pow(factorial(k), 3) * Math.pow(640320, 3 * k);
        sum += sign * numerator / denominator;
    }
    return C / sum;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(Number.isInteger(entity.metadata.row)).toBe(true);
            expect(Number.isInteger(entity.metadata.col)).toBe(true);
        }
    });
}

describe("Chudnovsky Pi", () => {
    it("matches the closed-form factorial series", () => {
        for (const terms of [1, 2, 3]) {
            const frames = [...mod.run({ terms })];
            checkFrames(frames);
            const pi = Number(frames[frames.length - 1]?.meta["pi"]);
            expect(pi).toBeCloseTo(reference(terms), 9);
        }
    });

    it("reaches pi to double precision within a few terms", () => {
        const frames = [...mod.run({ terms: 2 })];
        const pi = Number(frames[frames.length - 1]?.meta["pi"]);
        expect(Math.abs(pi - Math.PI)).toBeLessThan(1e-12);
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
