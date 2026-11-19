/** lagrange-four-square.test.ts - Brute-force cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./lagrange-four-square";
import type { VisualFrame } from "@/types";

function isqrt(n: number): number {
    return Math.floor(Math.sqrt(n));
}
function bruteFourSquares(n: number): boolean {
    const r = isqrt(n);
    for (let a = 0; a <= r; a += 1) {
        for (let b = 0; b <= r; b += 1) {
            for (let c = 0; c <= r; c += 1) {
                for (let d = 0; d <= r; d += 1) {
                    if (a * a + b * b + c * c + d * d === n) return true;
                }
            }
        }
    }
    return false;
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

describe("Lagrange four-square", () => {
    it("finds a valid representation for every small n", () => {
        for (let n = 0; n <= 40; n += 1) {
            const frames = [...mod.run({ n })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            expect(final["found"]).toBe(true);
            expect(bruteFourSquares(n)).toBe(true);
            const rep = final["representation"] as number[];
            expect(rep.reduce((s, v) => s + v * v, 0)).toBe(n);
            expect(final["sum"]).toBe(n);
        }
    });

    it("handles larger values", () => {
        for (const n of [99, 123, 500, 1000]) {
            const frames = [...mod.run({ n })];
            const final = frames[frames.length - 1]!.meta;
            const rep = final["representation"] as number[];
            expect(rep.reduce((s, v) => s + v * v, 0)).toBe(n);
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
