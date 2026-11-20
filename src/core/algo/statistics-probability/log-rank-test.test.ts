/** log-rank-test.test.ts - brute-force statistic, null equality, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./log-rank-test";
import type { VisualFrame } from "@/types";

function reference(g1: number[][], g2: number[][]): number {
    const times = Array.from(new Set([...g1, ...g2].map((p) => p[0]!))).sort((a, b) => a - b);
    let o = 0, e = 0, v = 0;
    for (const t of times) {
        const n1 = g1.filter((p) => p[0]! >= t).length;
        const n2 = g2.filter((p) => p[0]! >= t).length;
        const n = n1 + n2;
        const d1 = g1.filter((p) => p[0] === t && p[1] === 1).length;
        const d2 = g2.filter((p) => p[0] === t && p[1] === 1).length;
        const d = d1 + d2;
        if (d > 0 && n > 1) {
            o += d1;
            e += (d * n1) / n;
            v += (d * n1 * n2 * (n - d)) / (n * n * (n - 1));
        }
    }
    return v > 0 ? (o - e) ** 2 / v : 0;
}

function checkFrames(frames: VisualFrame[], times: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(times);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Log-Rank Test", () => {
    it("matches an independently computed log-rank statistic", () => {
        const cases = [
            { group1: [[1, 1], [2, 1], [3, 0], [4, 1], [5, 1]], group2: [[1, 0], [2, 0], [3, 1], [4, 1], [5, 1]] },
            { group1: [[1, 1], [2, 1], [3, 1], [4, 1]], group2: [[2, 0], [4, 0], [6, 1], [8, 1], [10, 1]] },
            { group1: [[1, 0], [3, 1], [5, 1]], group2: [[2, 1], [4, 1], [6, 0]] },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            const times = (frames.at(-1)?.meta["times"] as number[]).length;
            checkFrames(frames, times);
            expect(Number(frames.at(-1)?.meta["chiSquare"])).toBeCloseTo(reference(c.group1, c.group2), 9);
        }
    });

    it("returns zero for identical survival groups", () => {
        const group = [[1, 1], [2, 1], [3, 0], [4, 1], [5, 1]];
        const meta = [...mod.run({ group1: group, group2: group })].at(-1)?.meta;
        expect(Number(meta?.["chiSquare"])).toBeCloseTo(0, 9);
        expect(Number(meta?.["observed"])).toBeCloseTo(Number(meta?.["expected"]), 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
