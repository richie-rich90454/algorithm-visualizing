/**
 * berlekamp-root-finding.test.ts - Brute-force field evaluation cross-check,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./berlekamp-root-finding";
import type { VisualFrame } from "@/types";

/** Independent brute-force root search by evaluating every field element. */
function bruteRoots(coefficients: number[], p: number): number[] {
    const roots: number[] = [];
    for (let x = 0; x < p; x += 1) {
        let value = 0;
        for (let i = coefficients.length - 1; i >= 0; i -= 1) {
            value = (value * x + coefficients[i]!) % p;
        }
        if (((value % p) + p) % p === 0) {
            roots.push(x);
        }
    }
    return roots;
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

describe("Berlekamp Root Finding", () => {
    it("matches brute-force field evaluation", () => {
        const cases: Array<{ coefficients: number[]; p: number }> = [
            { coefficients: [6, 0, 0, 1], p: 7 },
            { coefficients: [1, 0, 1], p: 5 },
            { coefficients: [1, 1, 1], p: 11 },
            { coefficients: [0, 1], p: 13 },
            { coefficients: [2, 0, 0, 0, 1], p: 17 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1] as VisualFrame;
            expect(final.meta["roots"]).toEqual(bruteRoots(input.coefficients, input.p));
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
