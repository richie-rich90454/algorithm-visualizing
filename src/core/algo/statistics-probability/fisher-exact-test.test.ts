/**
 * fisher-exact-test.test.ts - Exact enumeration cross-checks.
 */

import { describe, expect, it } from "vitest";
import mod, { fisherExact } from "./fisher-exact-test";
import type { VisualFrame } from "@/types";

/** Exact binomial coefficient using BigInt arithmetic. */
function exactComb(n: number, k: number): bigint {
    if (k < 0 || k > n) {
        return 0n;
    }
    const kk = Math.min(k, n - k);
    let result = 1n;
    for (let i = 1; i <= kk; i += 1) {
        result = (result * BigInt(n - kk + i)) / BigInt(i);
    }
    return result;
}

/** Independent brute-force enumeration of the conditional distribution. */
function bruteForce(table: number[]) {
    const [a, b, c, d] = table;
    const r1 = a + b;
    const c1 = a + c;
    const n = r1 + c + d;
    const denominator = Number(exactComb(n, r1));
    const min = Math.max(0, r1 - (n - c1));
    const max = Math.min(r1, c1);
    const probabilities: number[] = [];
    for (let x = min; x <= max; x += 1) {
        probabilities.push(Number(exactComb(c1, x) * exactComb(n - c1, r1 - x)) / denominator);
    }
    const observed = Number(exactComb(c1, a) * exactComb(n - c1, r1 - a)) / denominator;
    let pGreater = 0;
    let pLess = 0;
    let pTwoSided = 0;
    for (let x = min; x <= max; x += 1) {
        const p = Number(exactComb(c1, x) * exactComb(n - c1, r1 - x)) / denominator;
        if (x >= a) {
            pGreater += p;
        }
        if (x <= a) {
            pLess += p;
        }
        if (p <= observed * (1 + 1e-9)) {
            pTwoSided += p;
        }
    }
    return { probabilities, observed, pGreater, pLess, pTwoSided, min, max };
}

function checkFrames(frames: VisualFrame[], supportLength: number): void {
    expect(frames.length).toBe(supportLength + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 + supportLength);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(3);
    });
}

describe("Fisher Exact Test", () => {
    it("matches brute-force enumeration on several tables", () => {
        const tables = [
            [3, 1, 1, 3],
            [5, 0, 1, 4],
            [2, 3, 4, 1],
            [0, 6, 5, 1],
            [1, 2, 2, 1],
        ];
        for (const table of tables) {
            const result = fisherExact(table);
            const expected = bruteForce(table);
            expect(result.support[0]).toBe(expected.min);
            expect(result.support[result.support.length - 1]).toBe(expected.max);
            result.probabilities.forEach((p, i) => {
                expect(p).toBeCloseTo(expected.probabilities[i], 10);
            });
            expect(result.observedProbability).toBeCloseTo(expected.observed, 10);
            expect(result.pGreater).toBeCloseTo(expected.pGreater, 10);
            expect(result.pLess).toBeCloseTo(expected.pLess, 10);
            expect(result.pTwoSided).toBeCloseTo(expected.pTwoSided, 10);
            const total = result.probabilities.reduce((sum, p) => sum + p, 0);
            expect(total).toBeCloseTo(1, 10);
        }
    });

    it("reproduces the classic tea-tasting p-value", () => {
        const result = fisherExact([3, 1, 1, 3]);
        expect(result.pTwoSided).toBeCloseTo(34 / 70, 10);
        expect(result.pGreater).toBeCloseTo(17 / 70, 10);
        expect(result.pLess).toBeCloseTo(69 / 70, 10);
    });

    it("reports p-values inside frames with well-formed cells", () => {
        const input = mod.defaultInput as { table: number[] };
        const frames = [...mod.run(input)];
        const expected = bruteForce(input.table);
        checkFrames(frames, expected.max - expected.min + 1);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["pTwoSided"])).toBeCloseTo(expected.pTwoSided, 10);
        expect(Number(final?.["pGreater"])).toBeCloseTo(expected.pGreater, 10);
        expect(Number(final?.["pLess"])).toBeCloseTo(expected.pLess, 10);
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
