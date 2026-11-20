/**
 * pearson-correlation.test.ts - Independent centered computation, sign and
 * bound properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./pearson-correlation";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[], points: Point[]): void {
    expect(frames.length).toBe(points.length + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(points.length);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent two-pass Pearson computation. */
function reference(points: Point[]): number {
    const n = points.length;
    const meanX = points.reduce((sum, p) => sum + p[0], 0) / n;
    const meanY = points.reduce((sum, p) => sum + p[1], 0) / n;
    let cross = 0;
    let vx = 0;
    let vy = 0;
    for (const [x, y] of points) {
        cross += (x - meanX) * (y - meanY);
        vx += (x - meanX) ** 2;
        vy += (y - meanY) ** 2;
    }
    return cross / Math.sqrt(vx * vy);
}

describe("PearsonCorrelation", () => {
    it("matches an independent centered computation", () => {
        const datasets: Point[][] = [
            [[1, 2], [2, 4], [3, 5], [4, 4], [5, 6]],
            [[1, 9], [2, 7], [3, 5], [4, 3], [5, 1]],
            [[1, 3], [2, 1], [3, 4], [4, 2], [5, 5], [6, 0]],
            [[10, 2], [20, 4], [30, 1], [40, 8]],
        ];
        for (const points of datasets) {
            const frames = [...mod.run({ points })];
            checkFrames(frames, points);
            const r = Number(frames[frames.length - 1]?.meta["r"]);
            expect(r).toBeCloseTo(reference(points), 8);
            expect(r).toBeGreaterThanOrEqual(-1);
            expect(r).toBeLessThanOrEqual(1);
        }
    });

    it("gives plus or minus one for perfect linear data", () => {
        const up: Point[] = [[0, 1], [1, 3], [2, 5], [3, 7]];
        const down: Point[] = [[0, 7], [1, 5], [2, 3], [3, 1]];
        expect(Number([...mod.run({ points: up })].at(-1)?.meta["r"])).toBeCloseTo(1, 10);
        expect(Number([...mod.run({ points: down })].at(-1)?.meta["r"])).toBeCloseTo(-1, 10);
    });

    it("is invariant to positive affine shifts and reports zero for a flat variable", () => {
        const base: Point[] = [[1, 2], [2, 5], [3, 1], [4, 8]];
        const shifted: Point[] = base.map(([x, y]) => [3 * x + 10, -2 * y + 4]);
        const rBase = Number([...mod.run({ points: base })].at(-1)?.meta["r"]);
        const rShifted = Number([...mod.run({ points: shifted })].at(-1)?.meta["r"]);
        expect(rShifted).toBeCloseTo(-rBase, 8);
        const flat: Point[] = [[1, 5], [2, 5], [3, 5]];
        expect(Number([...mod.run({ points: flat })].at(-1)?.meta["r"])).toBeCloseTo(0, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
