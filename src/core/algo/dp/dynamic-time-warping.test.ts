/**
 * dynamic-time-warping.test.ts - Brute-force distance check, path validity,
 * frame-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dynamic-time-warping";
import type { VisualFrame } from "@/types";

/** Exponential recursive reference for small inputs (no memoization). */
function bruteDTW(a: number[], b: number[], i: number, j: number): number {
    if (i === 0 && j === 0) {
        return Math.abs((a[0] ?? 0) - (b[0] ?? 0));
    }
    if (i === 0) {
        return bruteDTW(a, b, 0, j - 1) + Math.abs((a[0] ?? 0) - (b[j] ?? 0));
    }
    if (j === 0) {
        return bruteDTW(a, b, i - 1, 0) + Math.abs((a[i] ?? 0) - (b[0] ?? 0));
    }
    const local = Math.abs((a[i] ?? 0) - (b[j] ?? 0));
    return local + Math.min(
        bruteDTW(a, b, i - 1, j),
        bruteDTW(a, b, i, j - 1),
        bruteDTW(a, b, i - 1, j - 1),
    );
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta.rows).toBe(rows);
        expect(frame.meta.cols).toBe(cols);
    });
}

describe("DynamicTimeWarping", () => {
    it("matches a brute-force recursive reference on small sequences", () => {
        const cases: Array<{ a: number[]; b: number[] }> = [
            { a: [1], b: [1] },
            { a: [1, 2, 3], b: [1, 1, 3] },
            { a: [2, 0, 4, 1], b: [0, 3, 1] },
            { a: [5, 1, 3, 2], b: [1, 4, 2, 2] },
            { a: [0, 0, 1, 1, 0], b: [0, 1, 0, 1] },
        ];
        for (const { a, b } of cases) {
            const frames = [...mod.run({ a, b })];
            checkFrames(frames, a.length, b.length);
            const last = frames[frames.length - 1];
            const expected = bruteDTW(a, b, a.length - 1, b.length - 1);
            expect(last?.meta.distance).toBe(expected);
        }
    });

    it("returns a monotone path whose local costs sum to the distance", () => {
        const a = [1, 2, 3, 4, 2];
        const b = [1, 1, 3, 4];
        const frames = [...mod.run({ a, b })];
        const last = frames[frames.length - 1];
        const pathI = last?.meta.pathI as number[];
        const pathJ = last?.meta.pathJ as number[];
        expect(pathI.length).toBe(pathJ.length);
        expect(pathI[0]).toBe(0);
        expect(pathJ[0]).toBe(0);
        expect(pathI[pathI.length - 1]).toBe(a.length - 1);
        expect(pathJ[pathJ.length - 1]).toBe(b.length - 1);

        let localSum = 0;
        for (let k = 1; k < pathI.length; k += 1) {
            const di = (pathI[k] as number) - (pathI[k - 1] as number);
            const dj = (pathJ[k] as number) - (pathJ[k - 1] as number);
            expect(di === 0 || di === 1).toBe(true);
            expect(dj === 0 || dj === 1).toBe(true);
            expect(di + dj).toBeGreaterThan(0);
            localSum += Math.abs((a[pathI[k] as number] ?? 0) - (b[pathJ[k] as number] ?? 0));
        }
        localSum += Math.abs((a[0] ?? 0) - (b[0] ?? 0));
        expect(localSum).toBe(last?.meta.distance);
    });

    it("handles empty inputs and terminates cleanly", () => {
        const bothEmpty = [...mod.run({ a: [], b: [] })];
        expect(bothEmpty.length).toBe(1);
        expect(bothEmpty[0]?.meta.empty).toBe(true);
        expect(bothEmpty[0]?.meta.distance).toBe(0);

        const oneEmpty = [...mod.run({ a: [1, 2], b: [] })];
        expect(oneEmpty.length).toBe(1);
        expect(oneEmpty[0]?.meta.empty).toBe(true);

        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
