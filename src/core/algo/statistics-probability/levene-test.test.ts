/** levene-test.test.ts - brute-force median deviations and Levene F, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./levene-test";
import type { VisualFrame } from "@/types";

function median(a: number[]): number {
    const s = [...a].sort((x, y) => x - y);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] as number : ((s[m - 1] as number) + (s[m] as number)) / 2;
}
const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;

function referenceLevene(groups: number[][]): { w: number; medians: number[]; groupMeans: number[] } {
    const k = groups.length;
    const N = groups.reduce((s, g) => s + g.length, 0);
    const medians = groups.map(median);
    const deviations = groups.map((g, i) => g.map((v) => Math.abs(v - medians[i]!)));
    const gm = deviations.map(mean);
    const grand = mean(deviations.flat());
    let between = 0;
    for (let i = 0; i < k; i += 1) between += groups[i]!.length * (gm[i]! - grand) ** 2;
    let within = 0;
    for (let i = 0; i < k; i += 1) for (const d of deviations[i]!) within += (d - gm[i]!) ** 2;
    return { w: within > 0 ? (N - k) * between / ((k - 1) * within) : 0, medians, groupMeans: gm };
}

function checkFrames(frames: VisualFrame[], N: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * N);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Levene Test", () => {
    it("matches brute-force deviations and F on several group sets", () => {
        const cases: number[][][] = [
            [[8, 9, 10, 11, 12], [7, 9, 10, 11, 13], [4, 7, 10, 13, 16]],
            [[1, 2, 3, 4], [2, 4, 6, 8], [3, 6, 9, 12]],
            [[5, 5, 5, 5], [1, 9, 1, 9]],
            [[10, 11, 12], [10, 11, 12], [10, 11, 12]],
        ];
        for (const groups of cases) {
            const frames = [...mod.run({ groups })];
            const N = groups.reduce((s, g) => s + g.length, 0);
            checkFrames(frames, N);
            const ref = referenceLevene(groups);
            const final = frames.at(-1)?.meta;
            (final?.["medians"] as number[]).forEach((m, i) => expect(m).toBeCloseTo(ref.medians[i] as number, 9));
            (final?.["groupMeans"] as number[]).forEach((m, i) => expect(m).toBeCloseTo(ref.groupMeans[i] as number, 9));
            expect(Number(final?.["w"])).toBeCloseTo(ref.w, 9);
        }
    });

    it("returns F = 0 when all groups have the same deviations", () => {
        const final = [...mod.run({ groups: [[1, 2, 3], [10, 11, 12], [20, 21, 22]] })].at(-1)?.meta;
        expect(Number(final?.["w"])).toBeCloseTo(0, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
