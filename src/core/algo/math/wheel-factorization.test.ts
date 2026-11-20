/** wheel-factorization.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./wheel-factorization";
import type { VisualFrame } from "@/types";

/** Brute-force least factor greater than one. */
function leastFactor(n: number): number {
    if (n < 2) {
        return 0;
    }
    for (let d = 2; d * d <= n; d += 1) {
        if (n % d === 0) {
            return d;
        }
    }
    return n;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Wheel Factorization", () => {
    it("matches brute-force least factors for every n from 2 to 2000", () => {
        for (let n = 2; n <= 2000; n += 1) {
            const frames = [...mod.run({ n, basePrimes: [2, 3, 5] })];
            const factor = Number(frames[frames.length - 1]?.meta["factor"]);
            expect(factor, `least factor of ${n}`).toBe(leastFactor(n));
        }
    });

    it("handles a prime and a perfect square", () => {
        for (const n of [1009, 49, 1024]) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const factor = Number(frames[frames.length - 1]?.meta["factor"]);
            expect(factor).toBe(leastFactor(n));
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
