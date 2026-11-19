/**
 * kendall-tau.test.ts - Independent pair-counting check, perfect-order
 * extremes, axis symmetry and tie handling, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kendall-tau";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function checkFrames(frames: VisualFrame[], points: Point[]): void {
    const pairs = (points.length * (points.length - 1)) / 2;
    expect(frames.length).toBe(pairs + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(points.length);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Reference tau-b from an independent pair scan and tie-group tally. */
function reference(points: Point[]): number {
    const n = points.length;
    const n0 = (n * (n - 1)) / 2;
    const tie = (arr: number[]) => {
        const counts = new Map<number, number>();
        for (const value of arr) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        let sum = 0;
        for (const size of counts.values()) {
            sum += (size * (size - 1)) / 2;
        }
        return sum;
    };
    const n1 = tie(points.map((p) => p[0]));
    const n2 = tie(points.map((p) => p[1]));
    let c = 0;
    let d = 0;
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            const product = (points[i][0] - points[j][0]) * (points[i][1] - points[j][1]);
            if (product > 0) {
                c += 1;
            } else if (product < 0) {
                d += 1;
            }
        }
    }
    const denom = Math.sqrt((n0 - n1) * (n0 - n2));
    return denom === 0 ? 0 : (c - d) / denom;
}

describe("KendallTau", () => {
    it("matches an independent pair-counting computation", () => {
        const datasets: Point[][] = [
            [[1, 2], [2, 3], [3, 5], [4, 4], [5, 7], [6, 6]],
            [[1, 9], [2, 7], [3, 5], [4, 3], [5, 1]],
            [[1, 1], [2, 3], [2, 3], [4, 2], [5, 8]],
            [[3, 1], [1, 4], [4, 2], [2, 8], [5, 5], [6, 7]],
        ];
        for (const points of datasets) {
            const frames = [...mod.run({ points })];
            checkFrames(frames, points);
            const final = frames[frames.length - 1];
            expect(Number(final.meta["tau"])).toBeCloseTo(reference(points), 10);
        }
    });

    it("returns plus one and minus one for perfect orderings", () => {
        const up: Point[] = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]];
        const down: Point[] = [[0, 4], [1, 3], [2, 2], [3, 1], [4, 0]];
        expect(Number([...mod.run({ points: up })].at(-1)?.meta["tau"])).toBeCloseTo(1, 10);
        expect(Number([...mod.run({ points: down })].at(-1)?.meta["tau"])).toBeCloseTo(-1, 10);
    });

    it("is symmetric under swapping the two coordinates", () => {
        const points: Point[] = [[1, 3], [2, 1], [3, 5], [4, 4], [5, 7]];
        const swapped: Point[] = points.map(([x, y]) => [y, x]);
        const tau = Number([...mod.run({ points })].at(-1)?.meta["tau"]);
        const swappedTau = Number([...mod.run({ points: swapped })].at(-1)?.meta["tau"]);
        expect(swappedTau).toBeCloseTo(tau, 10);
    });

    it("counts tied pairs separately", () => {
        const points: Point[] = [[1, 2], [1, 2], [2, 3], [3, 3]];
        const final = [...mod.run({ points })].at(-1);
        expect(Number(final?.meta["tiePairs"])).toBeGreaterThan(0);
        expect(Number(final?.meta["tau"])).toBeCloseTo(reference(points), 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(17);
        expect(generator.next().done).toBe(true);
    });
});
