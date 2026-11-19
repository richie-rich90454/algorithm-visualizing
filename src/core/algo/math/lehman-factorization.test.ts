/** lehman-factorization.test.ts - Brute-force divisor cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./lehman-factorization";
import type { VisualFrame } from "@/types";

function smallestFactor(n: number): number {
    if (n % 2 === 0) return 2;
    for (let d = 3; d * d <= n; d += 2) {
        if (n % d === 0) return d;
    }
    return n;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Lehman factorization", () => {
    it("finds a genuine factor for many composite numbers", () => {
        const numbers = [8051, 91, 15, 21, 1001, 12345, 561, 455, 1009 * 1013];
        for (const n of numbers) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const f = Number(final["factor"]);
            expect(final["divides"]).toBe(true);
            expect(n % f).toBe(0);
            expect(f).toBeGreaterThan(1);
            expect(f).toBeLessThan(n);
            expect(f * Number(final["cofactor"])).toBe(n);
        }
    });

    it("handles even, square, and prime inputs without throwing", () => {
        const even = [...mod.run({ n: 36 })];
        expect(even[even.length - 1]!.meta["factor"]).toBe(2);
        const square = [...mod.run({ n: 49 })];
        expect(square[square.length - 1]!.meta["factor"]).toBe(7);
        const prime = [...mod.run({ n: 97 })];
        expect(prime[prime.length - 1]!.meta["factor"]).toBe(97);
    });

    it("finds a nontrivial divisor that splits any composite", () => {
        for (const n of [15, 21, 91, 1001, 8051, 12345]) {
            const frames = [...mod.run({ n })];
            const final = frames[frames.length - 1]!.meta;
            const f = Number(final["factor"]);
            expect(f).toBeGreaterThan(1);
            expect(f).toBeLessThan(n);
            expect(n % f).toBe(0);
            // A genuine divisor is bounded below by the true smallest factor.
            expect(f).toBeGreaterThanOrEqual(smallestFactor(n));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
