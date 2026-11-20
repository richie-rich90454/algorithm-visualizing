/**
 * interpolation-neville.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./interpolation-neville";
import type { VisualFrame } from "@/types";

/** Independent Lagrange interpolation reference. */
function lagrange(xs: number[], ys: number[], x: number): number {
    let result = 0;
    for (let i = 0; i < xs.length; i += 1) {
        let basis = 1;
        for (let j = 0; j < xs.length; j += 1) {
            if (i !== j) {
                basis *= (x - (xs[j] ?? 0)) / ((xs[i] ?? 0) - (xs[j] ?? 0));
            }
        }
        result += (ys[i] ?? 0) * basis;
    }
    return result;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            const row = Number(entity.metadata.row);
            const col = Number(entity.metadata.col);
            expect(row).toBeGreaterThanOrEqual(0);
            expect(row).toBeLessThan(n);
            expect(col).toBeGreaterThanOrEqual(0);
            expect(col).toBeLessThan(n);
        }
    });
}

describe("Neville Interpolation", () => {
    it("matches Lagrange interpolation on several polynomials", () => {
        const cases = [
            { xs: [0, 1, 2, 3], ys: [5, 4, 9, 26], x: 1.5 },
            { xs: [-2, -1, 0, 1, 2], ys: [4, 1, 0, 1, 4], x: 0.5 },
            { xs: [0, 1, 2], ys: [1, 2, 4], x: 1.25 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.xs.length);
            const value = Number(frames[frames.length - 1]?.meta["value"]);
            expect(value).toBeCloseTo(lagrange(input.xs, input.ys, input.x), 10);
        }
    });

    it("returns the exact data value at a node", () => {
        const input = { xs: [0, 1, 2, 3], ys: [5, 4, 9, 26], x: 2 };
        const frames = [...mod.run(input)];
        expect(Number(frames[frames.length - 1]?.meta["value"])).toBeCloseTo(9, 10);
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
