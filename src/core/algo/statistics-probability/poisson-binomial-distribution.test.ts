/** poisson-binomial-distribution.test.ts - Brute-force enumeration check. */

import { describe, expect, it } from "vitest";
import mod from "./poisson-binomial-distribution";
import type { VisualFrame } from "@/types";

/** Exhaustively enumerate every subset of successes for a small trial list. */
function bruteForce(ps: number[]): number[] {
    const result = new Array<number>(ps.length + 1).fill(0);
    const totalSubsets = 1 << ps.length;
    for (let mask = 0; mask < totalSubsets; mask += 1) {
        let probability = 1;
        let successes = 0;
        for (let i = 0; i < ps.length; i += 1) {
            if (mask & (1 << i)) {
                probability *= ps[i] ?? 0;
                successes += 1;
            } else {
                probability *= 1 - (ps[i] ?? 0);
            }
        }
        result[successes] = (result[successes] ?? 0) + probability;
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
    });
}

describe("Poisson-Binomial Distribution", () => {
    it("matches exhaustive subset enumeration for many random probability lists", () => {
        let seed = 99;
        const next = () => {
            seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 12; trial += 1) {
            const n = 3 + (trial % 5);
            const ps = Array.from({ length: n }, () => Number(next().toFixed(4)));
            const frames = [...mod.run({ probabilities: ps })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const expected = bruteForce(ps);
            const actual = final["pmf"] as number[];
            expect(actual.length).toBe(expected.length);
            for (let k = 0; k < expected.length; k += 1) {
                expect(Math.abs((actual[k] ?? 0) - (expected[k] ?? 0))).toBeLessThan(1e-12);
            }
            expect(Number(final["mean"])).toBeCloseTo(ps.reduce((a, b) => a + b, 0), 12);
            expect(Number(final["variance"])).toBeCloseTo(
                ps.reduce((sum, p) => sum + p * (1 - p), 0), 12);
            expect(Number(final["total"])).toBeCloseTo(1, 12);
        }
    });

    it("reduces to the binomial when all probabilities are equal", () => {
        const p = 0.25;
        const n = 8;
        const ps = new Array<number>(n).fill(p);
        const frames = [...mod.run({ probabilities: ps })];
        const actual = frames[frames.length - 1]!.meta["pmf"] as number[];
        for (let k = 0; k <= n; k += 1) {
            const choose = Array.from({ length: k }, (_, i) => (n - i) / (i + 1))
                .reduce((a, b) => a * b, 1);
            expect(actual[k] ?? 0).toBeCloseTo(choose * p ** k * (1 - p) ** (n - k), 12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
