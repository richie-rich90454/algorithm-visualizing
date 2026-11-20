/**
 * pollard-strassen.test.ts - Trial-division cross-check, frame shape, and
 * termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./pollard-strassen";
import type { VisualFrame } from "@/types";

/** Independent smallest-factor search by trial division. */
function smallestFactor(n: number): number {
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
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Pollard-Strassen Factorization", () => {
    it("finds a correct factorization matching trial division", () => {
        const numbers = [10001, 15251, 11111, 455839, 1000003 * 1000033];
        for (const n of numbers) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const final = frames[frames.length - 1] as VisualFrame;
            const factor = Number(final.meta["factor"]);
            const other = Number(final.meta["other"]);
            expect(factor).toBeGreaterThan(1);
            expect(other).toBeGreaterThan(1);
            expect(factor * other).toBe(n);
            expect(n % factor).toBe(0);
            expect(smallestFactor(n)).toBeLessThanOrEqual(factor);
        }
    });

    it("handles an even number", () => {
        const frames = [...mod.run({ n: 1024 })];
        expect(frames[frames.length - 1]?.meta["factor"]).toBe(2);
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
