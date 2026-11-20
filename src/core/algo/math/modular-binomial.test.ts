/**
 * modular-binomial.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./modular-binomial";
import type { VisualFrame } from "@/types";

/** Exact C(n,k) using BigInt arithmetic. */
function exactBinomial(n: number, k: number): bigint {
    const kk = Math.min(k, n - k);
    let result = 1n;
    for (let i = 1; i <= kk; i += 1) {
        result = (result * BigInt(n - kk + i)) / BigInt(i);
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
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(Number.isInteger(entity.metadata.row)).toBe(true);
            expect(Number.isInteger(entity.metadata.col)).toBe(true);
        }
    });
}

describe("Modular Binomial", () => {
    it("matches the exact binomial modulo several primes", () => {
        const cases: Array<[number, number, number]> = [
            [100, 50, 7],
            [50, 25, 101],
            [60, 30, 1000000007],
            [20, 10, 13],
            [17, 8, 2],
        ];
        for (const [n, k, p] of cases) {
            const frames = [...mod.run({ n, k, p })];
            checkFrames(frames);
            const result = Number(frames[frames.length - 1]?.meta["result"]);
            const expected = Number(exactBinomial(n, k) % BigInt(p));
            expect(result).toBe(expected);
        }
    });

    it("returns zero when a base-p digit of k exceeds that of n", () => {
        const frames = [...mod.run({ n: 5, k: 3, p: 2 })];
        expect(Number(frames[frames.length - 1]?.meta["result"])).toBe(Number(exactBinomial(5, 3) % 2n));
    });

    it("handles boundary values", () => {
        for (const [n, k] of [[10, 0], [10, 10], [0, 0]]) {
            const frames = [...mod.run({ n, k, p: 97 })];
            expect(Number(frames[frames.length - 1]?.meta["result"])).toBe(1);
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
