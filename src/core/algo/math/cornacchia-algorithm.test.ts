/** cornacchia-algorithm.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./cornacchia-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function resultOf(frames: VisualFrame[]): { x: number; y: number; d: number } {
    const meta = frames[frames.length - 1]?.meta;
    return {
        x: meta?.["x"] as number,
        y: meta?.["y"] as number,
        d: meta?.["d"] as number,
    };
}

describe("Cornacchia's algorithm", () => {
    it("never reports an incorrect representation", () => {
        const primes = [5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 53, 61, 73, 89, 97, 101];
        const ds = [1, 2, 3, 4, 5, 7, 10];
        for (const p of primes) {
            for (const d of ds) {
                const frames = [...mod.run({ p, d })];
                checkFrames(frames);
                const { x, y } = resultOf(frames);
                if (x >= 0) {
                    expect(x).toBeGreaterThan(0);
                    expect(y).toBeGreaterThanOrEqual(0);
                    expect(x * x + d * y * y).toBe(p);
                }
            }
        }
    });

    it("represents every prime congruent to 1 mod 4 as a sum of two squares", () => {
        const primes = [5, 13, 17, 29, 37, 41, 53, 61, 73, 89, 97, 101, 109, 113];
        for (const p of primes) {
            const frames = [...mod.run({ p, d: 1 })];
            const { x, y, d } = resultOf(frames);
            expect(d).toBe(1);
            expect(x).toBeGreaterThan(0);
            expect(x * x + y * y).toBe(p);
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
