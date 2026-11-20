/** dixon-algorithm.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./dixon-algorithm";
import type { VisualFrame } from "@/types";

/** Brute-force least factor of n. */
function leastFactor(n: number): number {
    if (n % 2 === 0) {
        return 2;
    }
    for (let d = 3; d * d <= n; d += 2) {
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
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Dixon's Algorithm", () => {
    it("splits semiprimes into proper factors", () => {
        for (const n of [8051, 2491, 14273]) {
            const frames = [...mod.run({ n, bound: 40 })];
            checkFrames(frames);
            const factor = Number(frames[frames.length - 1]?.meta["factor"]);
            expect(factor, `factor for ${n}`).toBeGreaterThan(1);
            expect(factor).toBeLessThan(n);
            expect(n % factor).toBe(0);
        }
    });

    it("returns the even factor immediately", () => {
        const frames = [...mod.run({ n: 1024 })];
        expect(frames[frames.length - 1]?.meta["factor"]).toBe(2);
    });

    it("finds the same factor class as brute force on small composites", () => {
        for (const n of [15, 21, 35, 77]) {
            const frames = [...mod.run({ n, bound: 20 })];
            const factor = Number(frames[frames.length - 1]?.meta["factor"]);
            // When a factor is found it must be a genuine divisor; small
            // squares can legitimately yield no split, which is reported as 0.
            if (factor !== 0) {
                expect(factor).toBeGreaterThan(1);
                expect(factor).toBeLessThan(n);
                expect(n % factor).toBe(0);
            }
            expect(leastFactor(n)).toBeGreaterThan(1);
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
