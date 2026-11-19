/**
 * brent-salamin-pi.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./brent-salamin-pi";
import type { VisualFrame } from "@/types";

/** Independent Brent-Salamin reference. */
function reference(iterations: number): number {
    let a = 1;
    let b = 1 / Math.SQRT2;
    let t = 0.25;
    let p = 1;
    for (let i = 0; i < iterations; i += 1) {
        const nextA = (a + b) / 2;
        const nextB = Math.sqrt(a * b);
        t -= p * (a - nextA) * (a - nextA);
        a = nextA;
        b = nextB;
        p *= 2;
    }
    return (a + b) * (a + b) / (4 * t);
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

describe("Brent-Salamin Pi", () => {
    it("matches the reference and converges to pi", () => {
        for (const iterations of [0, 1, 3, 6]) {
            const frames = [...mod.run({ iterations })];
            checkFrames(frames);
            const finalPi = Number(frames[frames.length - 1]?.meta["pi"]);
            expect(finalPi).toBeCloseTo(reference(iterations), 12);
            if (iterations >= 3) {
                expect(Math.abs(finalPi - Math.PI)).toBeLessThan(1e-12);
            }
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
