/** bartlett-test.test.ts - brute-force statistic, equal-variance property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./bartlett-test";
import type { VisualFrame } from "@/types";

function reference(groups: number[][]): number {
    const stats = groups.map((g) => {
        const mean = g.reduce((s, v) => s + v, 0) / g.length;
        return { n: g.length, v: g.reduce((s, x) => s + (x - mean) ** 2, 0) / (g.length - 1) };
    });
    const k = stats.length;
    const N = stats.reduce((s, g) => s + g.n, 0);
    const df = N - k;
    const pooled = stats.reduce((s, g) => s + (g.n - 1) * g.v, 0) / df;
    const T = df * Math.log(pooled) - stats.reduce((s, g) => s + (g.n - 1) * Math.log(g.v), 0);
    const C = 1 + (1 / (3 * (k - 1))) * (stats.reduce((s, g) => s + 1 / (g.n - 1), 0) - 1 / df);
    return T / C;
}

function checkFrames(frames: VisualFrame[], k: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(k);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bartlett Test", () => {
    it("matches an independently computed chi-square statistic", () => {
        const cases = [
            [[4, 5, 6, 5, 4], [5, 6, 7, 6, 5], [4, 4, 5, 6, 6]],
            [[1, 2, 3], [10, 11, 12, 13], [2, 20, 5, 9, 7]],
            [[3, 3, 4, 4], [1, 2, 8, 9], [5, 5, 5, 6]],
        ];
        for (const groups of cases) {
            const frames = [...mod.run({ groups })];
            checkFrames(frames, groups.length);
            expect(Number(frames.at(-1)?.meta["chiSquare"])).toBeCloseTo(reference(groups), 9);
        }
    });

    it("does not reject when all groups share a variance and rejects a clear spread difference", () => {
        const same = [...mod.run({ groups: [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6], [3, 4, 5, 6, 7]] })].at(-1)?.meta;
        expect(Number(same?.["chiSquare"])).toBeCloseTo(0, 9);
        expect(same?.["equalVariances"]).toBe(true);
        expect(Number(same?.["pValue"])).toBeGreaterThan(0.9);
        const different = [...mod.run({ groups: [[1, 1, 1, 1], [1, 1, 1, 1], [1, 100, 1, 100]] })].at(-1)?.meta;
        expect(Number(different?.["chiSquare"])).toBeGreaterThan(3);
        expect(different?.["equalVariances"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
