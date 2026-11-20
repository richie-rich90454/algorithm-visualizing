/** mood-test.test.ts - brute-force contingency counts and chi-square, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./mood-test";
import type { VisualFrame } from "@/types";

function median(a: number[]): number {
    const s = [...a].sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] as number : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

function referenceMood(groups: number[][]): { med: number; above: number[]; below: number[]; chi2: number } {
    const all = groups.flat();
    const med = median(all);
    const above = groups.map((g) => g.filter((v) => v > med).length);
    const below = groups.map((g, i) => g.length - (above[i] as number));
    const N = all.length;
    const totalAbove = above.reduce((s, v) => s + v, 0);
    const totalBelow = below.reduce((s, v) => s + v, 0);
    let chi2 = 0;
    for (let i = 0; i < groups.length; i += 1) {
        const row = (above[i] as number) + (below[i] as number);
        for (const [obs, col] of [[above[i] as number, totalAbove], [below[i] as number, totalBelow]]) {
            const exp = (row * col) / N;
            if (exp > 0) chi2 += (obs - exp) ** 2 / exp;
        }
    }
    return { med, above, below, chi2 };
}

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * k);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Mood's Median Test", () => {
    it("matches brute-force counts and chi-square on several group sets", () => {
        const cases: number[][][] = [
            [[12, 14, 15, 13, 16], [9, 11, 10, 8, 12], [14, 17, 16, 15, 18]],
            [[1, 2, 3, 4], [2, 4, 6, 8], [3, 6, 9, 12]],
            [[5, 5, 5, 5], [1, 9, 1, 9]],
        ];
        for (const groups of cases) {
            const frames = [...mod.run({ groups })];
            checkFrames(frames, groups.length);
            const ref = referenceMood(groups);
            const final = frames.at(-1)?.meta;
            expect(Number(final?.["median"])).toBeCloseTo(ref.med, 9);
            (final?.["above"] as number[]).forEach((v, i) => expect(v).toBe(ref.above[i]));
            (final?.["below"] as number[]).forEach((v, i) => expect(v).toBe(ref.below[i]));
            expect(Number(final?.["chi2"])).toBeCloseTo(ref.chi2, 9);
        }
    });

    it("returns chi-square zero when each group has the same above/below split", () => {
        const final = [...mod.run({ groups: [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]] })].at(-1)?.meta;
        expect(Number(final?.["chi2"])).toBeCloseTo(0, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
