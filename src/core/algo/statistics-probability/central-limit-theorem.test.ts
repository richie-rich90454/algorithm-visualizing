/**
 * central-limit-theorem.test.ts - Exhaustive outcome enumeration, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./central-limit-theorem";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], maxN: number, sides: number): void {
    expect(frames.length).toBe(maxN + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    });
    for (let n = 1; n <= maxN; n += 1) {
        expect(frames[n]?.entities.length).toBe(n * sides + 1);
    }
}

/** Enumerate every ordered outcome of n dice by counting sums recursively. */
function enumeratePmf(sides: number, n: number): number[] {
    const counts = new Array<number>(n * sides + 1).fill(0);
    const total = sides ** n;
    const recurse = (rolled: number, sum: number): void => {
        if (rolled === n) {
            counts[sum] = (counts[sum] ?? 0) + 1;
            return;
        }
        for (let face = 1; face <= sides; face += 1) {
            recurse(rolled + 1, sum + face);
        }
    };
    recurse(0, 0);
    return counts.map((count) => count / total);
}

describe("Central limit theorem (dice convolution)", () => {
    it("matches exhaustive enumeration of dice outcomes", () => {
        for (const [sides, maxN] of [
            [6, 3],
            [4, 4],
            [3, 4],
            [8, 2],
        ]) {
            const frames = [...mod.run({ sides, maxN })];
            checkFrames(frames, maxN as number, sides as number);
            for (let n = 1; n <= (maxN as number); n += 1) {
                const got = frames[n]?.meta["pmf"] as number[];
                const want = enumeratePmf(sides as number, n);
                expect(got.length).toBe(want.length);
                for (let k = 0; k < want.length; k += 1) {
                    expect(got[k]).toBeCloseTo(want[k]!, 10);
                }
            }
        }
    });

    it("has unit mass, exact moments, and generally shrinking normal distance", () => {
        const frames = [...mod.run({ sides: 6, maxN: 6 })];
        checkFrames(frames, 6, 6);
        for (let n = 1; n <= 6; n += 1) {
            const meta = frames[n]?.meta;
            const pmf = meta?.["pmf"] as number[];
            expect(pmf.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 10);
            expect(Number(meta?.["mean"])).toBeCloseTo((n * 7) / 2, 10);
            expect(Number(meta?.["variance"])).toBeCloseTo((n * 35) / 12, 10);
            const empiricalMean = pmf.reduce((s, p, k) => s + k * p, 0);
            expect(empiricalMean).toBeCloseTo((n * 7) / 2, 10);
        }
        const distances = frames[frames.length - 1]?.meta["distances"] as number[];
        expect(distances.length).toBe(6);
        expect(distances[5]!).toBeLessThan(distances[0]!);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
